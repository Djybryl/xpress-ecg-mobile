import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useCardiologistRatios } from '@/hooks/useCardiologistRatios';

const RATIO_STATUS_LABEL: Record<'OK' | 'ALERT' | 'SUSPENDED', string> = {
  OK: '✅ Ratio conforme',
  ALERT: '⚠️ Ratio en alerte',
  SUSPENDED: '🚫 Ratio suspendu',
};

const RATIO_STATUS_COLOR: Record<'OK' | 'ALERT' | 'SUSPENDED', string> = {
  OK: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
  ALERT: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  SUSPENDED: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
};

function formatPeriod(start: string, end: string): string {
  const s = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(start));
  const e = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(end));
  return s === e ? s : `${s} — ${e}`;
}

export default function CommissionsScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch } = useCardiologistRatios(user?.id);

  const latest = data?.latest;
  const history = data?.history ?? [];

  const ratioPercent = latest
    ? latest.ecg_premium_count + latest.ecg_free_count > 0
      ? Math.round((latest.ecg_free_count / (latest.ecg_premium_count + latest.ecg_free_count)) * 100)
      : 0
    : 0;

  return (
    <View
      className="flex-1 bg-gray-50 dark:bg-zinc-950"
      style={{ paddingTop: insets.top }}
    >
      <View className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <Text className="text-xl font-bold text-gray-900 dark:text-zinc-100">Ratios Give &amp; Get</Text>
        <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
          Proportion ECG gratuits / ECG payants interprétés
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 20, paddingBottom: insets.bottom + 24 }}
      >
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator color={joyful.primary} size="large" />
          </View>
        ) : error ? (
          <View className="py-16 items-center">
            <Text className="text-red-500 text-sm mb-4">{error}</Text>
            <TouchableOpacity onPress={() => void refetch()} className="px-6 py-2.5 bg-violet-600 rounded-xl">
              <Text className="text-white font-semibold text-sm">Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : !latest ? (
          <View className="py-16 items-center">
            <Text className="text-gray-500 dark:text-zinc-400 text-sm text-center">
              Aucun ratio disponible pour le moment.{'\n'}Les données apparaîtront après vos premières interprétations.
            </Text>
          </View>
        ) : (
          <>
            {/* Carte statut actuel */}
            <View className={`rounded-2xl border p-5 mb-4 ${RATIO_STATUS_COLOR[latest.ratio_status]}`}>
              <Text className="text-lg font-bold text-gray-800 dark:text-zinc-100">
                {RATIO_STATUS_LABEL[latest.ratio_status]}
              </Text>
              <Text className="text-sm text-gray-600 dark:text-zinc-300 mt-1">
                Période : {formatPeriod(latest.period_start, latest.period_end)}
              </Text>
              {latest.is_grace_period && (
                <Text className="text-xs text-amber-600 dark:text-amber-300 mt-2 font-medium">
                  Période de grâce active
                </Text>
              )}
            </View>

            {/* Barre de ratio */}
            <View className="bg-white dark:bg-zinc-900 rounded-2xl p-5 mb-4">
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-base mb-4">Répartition période actuelle</Text>
              <View className="flex-row mb-3">
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                    {latest.ecg_free_count}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-zinc-400">ECG gratuits</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                    {latest.ecg_premium_count}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-zinc-400">ECG payants</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-2xl font-bold" style={{ color: joyful.primary }}>
                    {ratioPercent}%
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-zinc-400">Gratuits</Text>
                </View>
              </View>
              {/* Barre visuelle */}
              <View className="h-3 rounded-full bg-gray-100 dark:bg-zinc-700 overflow-hidden">
                <View
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${ratioPercent}%` }}
                />
              </View>
              <Text className="text-xs text-gray-400 dark:text-zinc-500 mt-2">
                Objectif : ≥ 20% gratuits pour maintenir le ratio conforme
              </Text>
            </View>

            {/* Historique */}
            {history.length > 1 && (
              <View>
                <Text className="text-gray-800 dark:text-zinc-100 font-bold text-base mb-3">Historique</Text>
                {history.slice(1).map(row => {
                  const pct = row.ecg_premium_count + row.ecg_free_count > 0
                    ? Math.round((row.ecg_free_count / (row.ecg_premium_count + row.ecg_free_count)) * 100)
                    : 0;
                  return (
                    <View key={row.id} className="bg-white dark:bg-zinc-900 rounded-xl px-4 py-3 mb-2">
                      <Text className="text-sm text-gray-700 dark:text-zinc-300 font-medium">
                        {formatPeriod(row.period_start, row.period_end)}
                      </Text>
                      <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                        {row.ecg_free_count} gratuits · {row.ecg_premium_count} payants · {pct}% gratuits
                        {' · '}{RATIO_STATUS_LABEL[row.ratio_status]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
