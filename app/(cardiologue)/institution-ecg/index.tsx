import { useReducer, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, getApiErrorMessage } from '@/lib/apiClient';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { parseEcgListResponse } from '@/hooks/parseEcgListResponse';
import type { EcgRecordItem } from '@/hooks/useEcgList';
import { useTranslation } from '@/i18n';

const CACHE_KEY = 'xecg-institution-ecg';
const CACHE_TTL_MS = 2 * 60 * 1000;

type InstEnvelope = {
  ts: number;
  records: EcgRecordItem[];
  institutionNames: Record<string, string>;
};

async function readCache(): Promise<InstEnvelope | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as InstEnvelope;
    if (!Array.isArray(p.records) || typeof p.ts !== 'number' || typeof p.institutionNames !== 'object') return null;
    return p;
  } catch {
    return null;
  }
}

async function writeCache(records: EcgRecordItem[], institutionNames: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ts: Date.now(), records, institutionNames } satisfies InstEnvelope),
    );
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

function delaySinceSubmission(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  if (mins < 2) return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  return `Il y a ${Math.floor(hours / 24)} j`;
}

function filterPendingInstitutional(rows: EcgRecordItem[]): EcgRecordItem[] {
  return rows.filter(r => r.status !== 'completed');
}

function statusLabel(status: EcgRecordItem['status'], t: { status: Record<string, string> }): string {
  switch (status) {
    case 'pending':
      return t.status.pending;
    case 'assigned':
      return t.status.assigned;
    case 'analyzing':
      return t.status.analyzing;
    case 'completed':
      return t.status.completed;
    case 'validated':
      return t.status.validated;
    default:
      return status;
  }
}

interface QState {
  records: EcgRecordItem[];
  institutionNames: Record<string, string>;
  loading: boolean;
  error: string | null;
  fromCacheOnly: boolean;
}

type QAction =
  | { type: 'START' }
  | {
      type: 'OK';
      records: EcgRecordItem[];
      institutionNames: Record<string, string>;
      fromCacheOnly: boolean;
    }
  | {
      type: 'ERR';
      msg: string;
      records?: EcgRecordItem[];
      institutionNames?: Record<string, string>;
      fromCacheOnly?: boolean;
    };

function qReducer(s: QState, a: QAction): QState {
  switch (a.type) {
    case 'START':
      return { ...s, loading: true, error: null };
    case 'OK':
      return {
        ...s,
        loading: false,
        records: a.records,
        institutionNames: a.institutionNames,
        error: null,
        fromCacheOnly: a.fromCacheOnly,
      };
    case 'ERR':
      return {
        ...s,
        loading: false,
        error: a.msg,
        records: a.records !== undefined ? a.records : s.records,
        institutionNames: a.institutionNames !== undefined ? a.institutionNames : s.institutionNames,
        fromCacheOnly: a.fromCacheOnly ?? s.fromCacheOnly,
      };
    default:
      return s;
  }
}

const qInitial: QState = {
  records: [],
  institutionNames: {},
  loading: true,
  error: null,
  fromCacheOnly: false,
};

export default function InstitutionEcgScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const { t } = useTranslation();
  const enabled = user?.role === 'cardiologue';
  const [state, dispatch] = useReducer(qReducer, qInitial);

  const load = useCallback(async () => {
    if (!enabled || !user?.id) {
      dispatch({
        type: 'OK',
        records: [],
        institutionNames: {},
        fromCacheOnly: false,
      });
      return;
    }
    dispatch({ type: 'START' });
    try {
      const envelope = await readCache();
      if (envelope && Date.now() - envelope.ts < CACHE_TTL_MS) {
        dispatch({
          type: 'OK',
          records: envelope.records,
          institutionNames: envelope.institutionNames,
          fromCacheOnly: false,
        });
      }

      const [econRaw, listRaw] = await Promise.all([
        api.get<{ institutional?: Array<{ institution_id: string; institution_name: string }> }>('/auth/me/economy'),
        api.get<unknown>('/ecg-records', {
          assigned_to: user.id,
          routing_mode: 'institutional',
          solidarity_ranked: false,
          limit: 80,
        }),
      ]);

      const institutionNames: Record<string, string> = {};
      for (const row of econRaw.institutional ?? []) {
        institutionNames[row.institution_id] = row.institution_name || 'Institution';
      }

      const { records: rawList } = parseEcgListResponse(listRaw);
      const pending = filterPendingInstitutional(rawList);
      void writeCache(pending, institutionNames);
      dispatch({
        type: 'OK',
        records: pending,
        institutionNames,
        fromCacheOnly: false,
      });
    } catch (e) {
      if (isNetworkFailure(e)) {
        const cached = await readCache();
        if (cached?.records.length) {
          dispatch({
            type: 'ERR',
            msg: 'offline',
            records: cached.records,
            institutionNames: cached.institutionNames,
            fromCacheOnly: true,
          });
        } else {
          dispatch({
            type: 'ERR',
            msg: getApiErrorMessage(e),
            records: [],
            institutionNames: {},
            fromCacheOnly: false,
          });
        }
      } else {
        dispatch({ type: 'ERR', msg: getApiErrorMessage(e) });
      }
    }
  }, [enabled, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!enabled) {
    return (
      <View className="flex-1 justify-center p-6 bg-white dark:bg-zinc-950">
        <Stack.Screen options={{ title: 'ECG institutionnels' }} />
        <Text className="text-center text-gray-600" accessibilityRole="text">
          Réservé aux cardiologues.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <Stack.Screen options={{ title: 'ECG institutionnels' }} />
      {state.fromCacheOnly ? (
        <View
          className="m-3 p-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/50"
          accessibilityRole="alert"
          accessibilityLabel="Hors ligne, liste affichée depuis le cache"
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
        <ActivityIndicator className="mt-10" color={joyful.primary} accessibilityLabel="Chargement en cours" />
      ) : (
        <FlatList
          data={state.records}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={state.loading} onRefresh={load} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={(
            <Text className="text-center text-gray-500 mt-8" accessibilityRole="text">
              Aucun ECG institutionnel en attente.
            </Text>
          )}
          renderItem={({ item }) => {
            const urgent = item.urgency === 'urgent';
            const instId = item.ecg_institution_id ?? '';
            const instName =
              (instId && state.institutionNames[instId]) ||
              (instId ? 'Institution' : '—');
            const stat = statusLabel(item.status, t);
            return (
              <TouchableOpacity
                className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-zinc-800"
                activeOpacity={0.85}
                onPress={() => router.push(`/(cardiologue)/interpret/${item.id}` as Href)}
                accessibilityRole="button"
                accessibilityLabel={`ECG institutionnel de ${item.patient_name}, ${instName}, ${stat}${urgent ? ', urgent' : ''}`}
              >
                <View className="flex-row flex-wrap gap-2 mb-2">
                  <View
                    className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950"
                    accessibilityRole="text"
                    accessibilityLabel={`Institution ${instName}`}
                  >
                    <Text className="text-[10px] font-bold text-teal-800 dark:text-teal-200" numberOfLines={1}>
                      {instName}
                    </Text>
                  </View>
                  <View
                    className={`px-2 py-0.5 rounded-full ${urgent ? 'bg-red-100 dark:bg-red-950' : 'bg-slate-100 dark:bg-zinc-800'}`}
                    accessibilityRole="text"
                    accessibilityLabel={urgent ? 'Urgent' : 'Non urgent'}
                  >
                    <Text className={`text-[10px] font-bold ${urgent ? 'text-red-700' : 'text-gray-600'}`}>
                      {urgent ? 'URGENT' : 'Standard'}
                    </Text>
                  </View>
                </View>
                <Text className="text-base font-bold text-gray-900 dark:text-zinc-100" accessibilityRole="header">
                  {item.patient_name}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-1" accessibilityRole="text">
                  Soumis {delaySinceSubmission(item.created_at)} · {stat}
                </Text>
                {item.reference ? (
                  <Text className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">{item.reference}</Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
