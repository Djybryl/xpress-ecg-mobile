import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useCrcNetworks, type CrcNetworkItem } from '@/hooks/useCrcNetworks';
import { api, getApiErrorMessage } from '@/lib/apiClient';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(iso));
}

export default function CrcNetworksScreen() {
  const { user } = useAuth();
  const enabled = user?.role === 'medecin';
  const { networks, loading, error, refetch, fromCacheOnly, accessibilityLabelOffline } = useCrcNetworks(!!enabled);
  const [busyId, setBusyId] = useState<string | null>(null);

  const accept = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await api.patch(`/crc/prescripteurs/${id}/accept`, {});
        await refetch();
      } catch (e) {
        Alert.alert('Erreur', getApiErrorMessage(e));
      } finally {
        setBusyId(null);
      }
    },
    [refetch],
  );

  const removeLink = useCallback(
    async (id: string, title: string, message: string) => {
      Alert.alert(title, message, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(id);
              try {
                await api.delete(`/crc/prescripteurs/${id}`);
                await refetch();
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
    [refetch],
  );

  if (!enabled) {
    return (
      <View className="flex-1 justify-center p-5 bg-white dark:bg-zinc-900">
        <Stack.Screen options={{ title: 'Mes réseaux CRC' }} />
        <Text className="text-center text-slate-600">Réservé aux médecins prescripteurs.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <Stack.Screen options={{ title: 'Mes réseaux CRC' }} />
      {fromCacheOnly ? (
        <View
          className="m-3 p-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/50"
          accessibilityRole="alert"
          accessibilityLabel={accessibilityLabelOffline}
        >
          <Text className="text-amber-900 dark:text-amber-100 text-xs">Hors ligne — données en cache.</Text>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-red-600 px-4 text-sm">
          {error}
        </Text>
      ) : null}
      {loading && networks.length === 0 ? (
        <ActivityIndicator className="mt-10" />
      ) : networks.length === 0 ? (
        <View className="p-6">
          <Text accessibilityRole="text" className="text-slate-600 dark:text-slate-400 text-center text-base">
            Vous n&apos;appartenez à aucun réseau CRC.
          </Text>
        </View>
      ) : (
        <FlatList
          data={networks}
          keyExtractor={(n) => n.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }: { item: CrcNetworkItem }) => {
            const busy = busyId === item.id;
            const displayName = item.cardiologue_pseudo?.trim() || item.cardiologue_name;
            return (
              <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-zinc-800">
                <Text className="text-lg font-bold text-slate-900 dark:text-zinc-100">{displayName}</Text>
                <Text className="text-xs text-slate-500 mt-1">
                  Statut : {item.status === 'active' ? 'Actif' : 'En attente'}
                </Text>
                <Text className="text-xs text-slate-500">Depuis le {formatDate(item.invited_at)}</Text>

                {item.status === 'pending' ? (
                  <View className="flex-row gap-2 mt-3">
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Accepter l'invitation CRC"
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      className={`flex-1 py-2.5 rounded-xl items-center ${busy ? 'bg-slate-300' : 'bg-emerald-600'}`}
                      onPress={() => accept(item.id)}
                    >
                      <Text className="text-white font-semibold">Accepter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Refuser l'invitation CRC"
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      className={`flex-1 py-2.5 rounded-xl items-center border border-red-400 ${busy ? 'opacity-50' : ''}`}
                      onPress={() =>
                        removeLink(
                          item.id,
                          'Refuser',
                          'Refuser cette invitation au réseau CRC ?',
                        )
                      }
                    >
                      <Text className="text-red-600 font-semibold">Refuser</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Quitter ce réseau CRC"
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    className={`mt-3 py-2.5 rounded-xl items-center border border-slate-300 ${busy ? 'opacity-50' : ''}`}
                    onPress={() =>
                      removeLink(
                        item.id,
                        'Quitter le réseau',
                        'Quitter définitivement ce réseau CRC ?',
                      )
                    }
                  >
                    <Text className="text-slate-700 font-semibold">Quitter ce réseau</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
