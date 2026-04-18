import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEconomyMe } from '@/hooks/useEconomyMe';

function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  return (
    <View className="h-2 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

export default function SecretaireSubscriptionsScreen() {
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const { data, loading, error, refetch } = useEconomyMe(true);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const sub = data?.subscription;
  const quota = data?.quota;
  const used = sub ? sub.ecg_used_this_month : (quota?.ecg_used ?? 0);
  const limit = sub ? sub.monthly_ecg_quota : (quota?.ecg_limit ?? 0);
  const ratio = limit > 0 ? used / limit : 0;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-950" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-3 pb-3 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
        <Text className="text-xl font-bold text-gray-900 dark:text-zinc-100">Quota & abonnement</Text>
        <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
          Vue lecture seule pour votre établissement
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={joyful.primary} />
        }
      >
        {loading && !refreshing && (
          <ActivityIndicator color={joyful.primary} style={{ marginTop: 32 }} />
        )}
        {error && !loading && (
          <Text className="text-red-600 text-sm mt-4">{error}</Text>
        )}

        {!loading && data && (
          <>
            <View className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-4">
              <View className="flex-row items-start gap-2">
                <Ionicons name="information-circle" size={20} color="#d97706" style={{ marginTop: 2 }} />
                <Text className="text-[13px] text-amber-900 dark:text-amber-100 flex-1">
                  La modification des forfaits (STARTER / PRO / INSTITUTION) et les règles par plan seront
                  intégrées ultérieurement. Cet écran affiche uniquement le contexte quota actuel.
                </Text>
              </View>
            </View>

            <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 shadow-sm">
              <Text className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
                Contexte
              </Text>
              <Text className="text-sm text-gray-800 dark:text-zinc-200">
                Mois : <Text className="font-semibold">{data.monthYear}</Text>
              </Text>
              <Text className="text-sm text-gray-800 dark:text-zinc-200 mt-1">
                Niveau d&apos;accès :{' '}
                <Text className="font-semibold">{data.accessLevel}</Text>
              </Text>
              {data.hospitalId ? (
                <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-2" numberOfLines={2}>
                  Établissement : {data.hospitalId}
                </Text>
              ) : (
                <Text className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                  Aucun établissement rattaché au compte — les quotas hôpital ne s&apos;affichent pas.
                </Text>
              )}
            </View>

            {sub && (
              <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 shadow-sm">
                <Text className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
                  Abonnement hôpital (actif)
                </Text>
                <Text className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                  Plan {sub.plan} · {sub.status}
                </Text>
                <Text className="text-sm text-gray-600 dark:text-zinc-400 mt-2">
                  ECG ce mois : {used} / {limit}
                </Text>
                <View className="mt-3">
                  <ProgressBar ratio={ratio} color={joyful.primary} />
                </View>
              </View>
            )}

            {!sub && quota && data.accessLevel === 'GRATUIT' && (
              <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 shadow-sm">
                <Text className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
                  Quota utilisateur (gratuit)
                </Text>
                <Text className="text-sm text-gray-800 dark:text-zinc-200">
                  {quota.ecg_used} / {quota.ecg_limit} ECG ce mois
                </Text>
                <View className="mt-3">
                  <ProgressBar ratio={quota.ecg_limit > 0 ? quota.ecg_used / quota.ecg_limit : 0} color={joyful.primary} />
                </View>
              </View>
            )}

            {!sub && data.accessLevel === 'PREMIUM' && !quota && (
              <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 shadow-sm">
                <Text className="text-sm text-gray-700 dark:text-zinc-300">
                  Compte PREMIUM sans abonnement hôpital enregistré — pas de plafond mensuel sur ces indicateurs.
                </Text>
              </View>
            )}

            <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm">
              <Text className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
                Envoi ECG (gate)
              </Text>
              <Text className="text-sm text-gray-800 dark:text-zinc-200">
                {data.gate.allowed ? 'Autorisé' : 'Bloqué'}
                {data.gate.remaining != null ? ` · reste : ${data.gate.remaining}` : ''}
              </Text>
              {!data.gate.allowed && data.gate.reason ? (
                <Text className="text-xs text-red-600 mt-2">{data.gate.reason}</Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
