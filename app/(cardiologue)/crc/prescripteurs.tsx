import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, getApiErrorMessage } from '@/lib/apiClient';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import type { PrescripteurItem } from '@/hooks/useCrcPrescripteursTypes';

const CACHE_KEY = 'xecg-crc-prescripteurs';
const CACHE_TTL_MS = 3 * 60 * 1000;

type Envelope = { ts: number; items: PrescripteurItem[] };

async function readCache(): Promise<Envelope | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Envelope;
    if (!Array.isArray(p.items) || typeof p.ts !== 'number') return null;
    return p;
  } catch {
    return null;
  }
}

async function writeCache(items: PrescripteurItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items } satisfies Envelope));
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

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(iso));
}

export default function CrcPrescripteursScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const enabled = user?.role === 'cardiologue';
  const [items, setItems] = useState<PrescripteurItem[]>([]);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState<string | null>(null);
  const [fromCacheOnly, setFromCacheOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    setFromCacheOnly(false);
    try {
      const env = await readCache();
      if (env && Date.now() - env.ts < CACHE_TTL_MS) {
        setItems(env.items);
      }
      const list = await api.get<PrescripteurItem[]>('/crc/prescripteurs');
      const data = Array.isArray(list) ? list : [];
      setItems(data);
      void writeCache(data);
    } catch (e) {
      if (isNetworkFailure(e)) {
        const c = await readCache();
        if (c?.items.length) {
          setItems(c.items);
          setFromCacheOnly(true);
          setError(null);
        } else {
          setError(getApiErrorMessage(e));
        }
      } else {
        setError(getApiErrorMessage(e));
        const c = await readCache();
        if (c?.items.length) setItems(c.items);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = useCallback(async () => {
    const em = email.trim().toLowerCase();
    if (!em || !em.includes('@')) {
      Alert.alert('Email', 'Adresse email invalide.');
      return;
    }
    setInviting(true);
    try {
      await api.post('/crc/prescripteurs/invite', { email: em });
      setInviteOpen(false);
      setEmail('');
      await load();
      Alert.alert('Invitation', 'Invitation envoyée.');
    } catch (e) {
      Alert.alert('Erreur', getApiErrorMessage(e));
    } finally {
      setInviting(false);
    }
  }, [email, load]);

  const revoke = useCallback(
    (row: PrescripteurItem) => {
      Alert.alert('Révoquer', `Retirer ${row.name} de votre réseau CRC ?`, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Révoquer',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(row.id);
              try {
                await api.delete(`/crc/prescripteurs/${row.id}`);
                await load();
              } catch (e) {
                Alert.alert('Erreur', getApiErrorMessage(e));
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ]);
    },
    [load],
  );

  if (!enabled) {
    return (
      <View className="flex-1 justify-center p-6 bg-white dark:bg-zinc-950">
        <Stack.Screen options={{ title: 'Prescripteurs' }} />
        <Text className="text-center text-gray-600">Réservé aux cardiologues.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <Stack.Screen
        options={{
          title: 'Prescripteurs',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setInviteOpen(true)}
              className="px-3 py-1"
              accessibilityRole="button"
              accessibilityLabel="Inviter un prescripteur par email"
            >
              <Text className="text-violet-600 font-bold text-sm">Inviter</Text>
            </TouchableOpacity>
          ),
        }}
      />
      {fromCacheOnly ? (
        <View
          className="m-3 p-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/50"
          accessibilityRole="alert"
        >
          <Text className="text-amber-900 dark:text-amber-100 text-xs">Hors ligne — données en cache.</Text>
        </View>
      ) : null}
      {error ? (
        <Text className="text-red-600 px-4 text-sm" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {loading && items.length === 0 ? (
        <ActivityIndicator className="mt-10" color={joyful.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={r => r.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ListFooterComponent={(
            <TouchableOpacity
              className="mt-4 bg-violet-600 rounded-2xl py-4 items-center"
              onPress={() => setInviteOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Inviter un prescripteur"
            >
              <Text className="text-white font-bold">Inviter un prescripteur</Text>
            </TouchableOpacity>
          )}
          renderItem={({ item }) => {
            const pending = item.status === 'pending';
            const busy = busyId === item.id;
            return (
              <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-zinc-800">
                <Text className="text-lg font-bold text-gray-900 dark:text-zinc-100">{item.name}</Text>
                <Text className="text-xs text-gray-500">{item.email}</Text>
                <View className="flex-row flex-wrap gap-2 mt-2">
                  <View className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800">
                    <Text className="text-[10px] font-bold text-gray-700 dark:text-zinc-300">
                      {item.status === 'active' ? 'Actif' : 'En attente'}
                    </Text>
                  </View>
                  {pending ? (
                    <View className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40">
                      <Text className="text-[10px] font-bold text-amber-800 dark:text-amber-200">
                        En attente d&apos;acceptation
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-xs text-gray-500 mt-1">Adhésion : {formatDate(item.invited_at)}</Text>
                <Text className="text-xs text-gray-600 dark:text-zinc-400 mt-1">
                  ECG ce mois : {item.ecg_this_month}
                </Text>
                <TouchableOpacity
                  className="mt-3 border border-red-300 rounded-xl py-2.5 items-center"
                  onPress={() => revoke(item)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Révoquer ${item.name} du réseau CRC`}
                  accessibilityState={{ disabled: busy }}
                >
                  {busy ? (
                    <ActivityIndicator color="#dc2626" />
                  ) : (
                    <Text className="text-red-600 font-semibold">Révoquer</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      <Modal visible={inviteOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/40"
        >
          <View className="bg-white dark:bg-zinc-900 rounded-t-3xl p-5">
            <Text className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-2" accessibilityRole="header">
              Inviter un prescripteur
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="email@exemple.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              className="border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-3 text-gray-900 dark:text-zinc-100 mb-3"
              accessibilityLabel="Email du prescripteur à inviter"
            />
            <TouchableOpacity
              className="bg-violet-600 rounded-xl py-3 items-center mb-2"
              onPress={() => { void invite(); }}
              disabled={inviting}
              accessibilityRole="button"
              accessibilityLabel="Envoyer l&apos;invitation"
              accessibilityState={{ disabled: inviting }}
            >
              {inviting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Envoyer</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setInviteOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Fermer la fenêtre d&apos;invitation"
            >
              <Text className="text-center text-gray-600 py-2">Annuler</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
