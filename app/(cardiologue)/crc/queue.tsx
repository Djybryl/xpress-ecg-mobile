import { useReducer, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, getApiErrorMessage } from '@/lib/apiClient';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';

export interface CrcEcgQueueRow {
  ecg_record_id: string;
  patient_name: string;
  urgency: string;
  clinical_context: string | null;
  created_at: string;
  status: string;
  assigned_to: string | null;
}

const CACHE_KEY = 'xecg-crc-queue';
const CACHE_TTL_MS = 3 * 60 * 1000;

type QEnvelope = { ts: number; records: CrcEcgQueueRow[] };

async function readCache(): Promise<QEnvelope | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as QEnvelope;
    if (!Array.isArray(p.records) || typeof p.ts !== 'number') return null;
    return p;
  } catch {
    return null;
  }
}

async function writeCache(records: CrcEcgQueueRow[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), records } satisfies QEnvelope));
  } catch {
    /* ignore */
  }
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 0 || err.code === 'SERVER_UNREACHABLE' || err.code === 'REQUEST_TIMEOUT';
  }
  return false;
}

function minutesSince(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h`;
}

function isCrcBalanceError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.code === 'INSUFFICIENT_CRC_BALANCE') return true;
  if (err.status === 402) return true;
  const m = (err.message || '').toLowerCase();
  return err.status === 403 && (m.includes('solde') || m.includes('crc'));
}

interface QState {
  records: CrcEcgQueueRow[];
  loading: boolean;
  error: string | null;
  takingId: string | null;
  fromCacheOnly: boolean;
}

type QAction =
  | { type: 'START' }
  | { type: 'OK'; records: CrcEcgQueueRow[]; fromCacheOnly: boolean }
  | { type: 'ERR'; msg: string; records?: CrcEcgQueueRow[]; fromCacheOnly?: boolean }
  | { type: 'TAKING'; id: string | null };

function qReducer(s: QState, a: QAction): QState {
  switch (a.type) {
    case 'START':
      return { ...s, loading: true, error: null };
    case 'OK':
      return {
        ...s,
        loading: false,
        records: a.records,
        error: null,
        fromCacheOnly: a.fromCacheOnly,
      };
    case 'ERR':
      return {
        ...s,
        loading: false,
        error: a.msg,
        records: a.records !== undefined ? a.records : s.records,
        fromCacheOnly: a.fromCacheOnly ?? s.fromCacheOnly,
      };
    case 'TAKING':
      return { ...s, takingId: a.id };
    default:
      return s;
  }
}

const qInitial: QState = {
  records: [],
  loading: true,
  error: null,
  takingId: null,
  fromCacheOnly: false,
};

export default function CrcQueueScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const enabled = user?.role === 'cardiologue';
  const [state, dispatch] = useReducer(qReducer, qInitial);

  const load = useCallback(async () => {
    if (!enabled || !user?.id) {
      dispatch({ type: 'OK', records: [], fromCacheOnly: false });
      return;
    }
    dispatch({ type: 'START' });
    try {
      const envelope = await readCache();
      if (envelope && Date.now() - envelope.ts < CACHE_TTL_MS) {
        dispatch({ type: 'OK', records: envelope.records, fromCacheOnly: false });
      }
      const rows = await api.get<CrcEcgQueueRow[]>('/crc/ecg-queue', { status: 'pending', limit: 50 });
      const list = Array.isArray(rows) ? rows : [];
      void writeCache(list);
      dispatch({ type: 'OK', records: list, fromCacheOnly: false });
    } catch (e) {
      if (isNetworkFailure(e)) {
        const cached = await readCache();
        if (cached?.records.length) {
          dispatch({
            type: 'ERR',
            msg: 'offline',
            records: cached.records,
            fromCacheOnly: true,
          });
        } else {
          dispatch({ type: 'ERR', msg: getApiErrorMessage(e), records: [], fromCacheOnly: false });
        }
      } else {
        dispatch({ type: 'ERR', msg: getApiErrorMessage(e) });
      }
    }
  }, [enabled, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const take = useCallback(
    async (id: string) => {
      dispatch({ type: 'TAKING', id });
      try {
        await api.post(`/ecg-records/${id}/start-analysis`, {});
        await load();
        router.push(`/(cardiologue)/interpret/${id}` as Href);
      } catch (e) {
        if (isCrcBalanceError(e)) {
          Alert.alert('Solde CRC insuffisant', 'Recharger votre portefeuille CRC ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Recharger', onPress: () => router.push('/(cardiologue)/crc/recharge' as Href) },
          ]);
        } else {
          Alert.alert('Erreur', getApiErrorMessage(e));
        }
      } finally {
        dispatch({ type: 'TAKING', id: null });
      }
    },
    [load],
  );

  if (!enabled) {
    return (
      <View className="flex-1 justify-center p-6 bg-white dark:bg-zinc-950">
        <Stack.Screen options={{ title: 'File ECG réseau' }} />
        <Text className="text-center text-gray-600">Réservé aux cardiologues.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <Stack.Screen options={{ title: 'File téléconsultation CRC' }} />
      {state.fromCacheOnly ? (
        <View
          className="m-3 p-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/50"
          accessibilityRole="alert"
          accessibilityLabel="Hors ligne, file affichée depuis le cache"
        >
          <Text className="text-amber-900 dark:text-amber-100 text-xs">Hors ligne — données en cache.</Text>
        </View>
      ) : null}
      {state.error && state.error !== 'offline' ? (
        <Text className="text-red-600 px-4 text-sm" accessibilityRole="alert">
          {state.error}
        </Text>
      ) : null}
      {state.loading && state.records.length === 0 ? (
        <ActivityIndicator className="mt-10" color={joyful.primary} />
      ) : (
        <FlatList
          data={state.records}
          keyExtractor={item => item.ecg_record_id}
          refreshControl={<RefreshControl refreshing={state.loading} onRefresh={load} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={(
            <Text className="text-center text-gray-500 mt-8" accessibilityRole="text">
              Aucun ECG en attente dans votre réseau.
            </Text>
          )}
          renderItem={({ item }) => {
            const urgent = item.urgency === 'urgent';
            const busy = state.takingId === item.ecg_record_id;
            return (
              <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-zinc-800">
                <View className="flex-row items-center gap-2 mb-2">
                  <View
                    className={`px-2 py-0.5 rounded-full ${urgent ? 'bg-red-100 dark:bg-red-950' : 'bg-slate-100 dark:bg-zinc-800'}`}
                    accessibilityRole="text"
                  >
                    <Text className={`text-[10px] font-bold ${urgent ? 'text-red-700' : 'text-gray-600'}`}>
                      {urgent ? 'URGENT' : 'Standard'}
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-500">Attente {minutesSince(item.created_at)}</Text>
                </View>
                <Text className="text-base font-bold text-gray-900 dark:text-zinc-100" accessibilityRole="header">
                  {item.patient_name}
                </Text>
                {item.clinical_context ? (
                  <Text className="text-sm text-gray-600 dark:text-zinc-400 mt-1" numberOfLines={4}>
                    {item.clinical_context}
                  </Text>
                ) : null}
                <TouchableOpacity
                  className="mt-3 bg-violet-600 rounded-xl py-3 items-center"
                  onPress={() => { void take(item.ecg_record_id); }}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Prendre en charge l&apos;ECG de ${item.patient_name}`}
                  accessibilityState={{ disabled: busy }}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Prendre en charge</Text>}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
