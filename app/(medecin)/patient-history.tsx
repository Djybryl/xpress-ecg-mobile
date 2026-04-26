import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePatientEcgHistory } from '@/hooks/usePatientEcgHistory';
import type { EcgRecordItem } from '@/hooks/useEcgList';

/** Champs supplémentaires renvoyés par l'API pour les ECG terminés. */
interface CompletedEcgRecord extends EcgRecordItem {
  is_normal?: boolean | null;
  conclusion?: string | null;
  heart_rate?: number | null;
  qtc_interval?: number | null;
  interpreted_at?: string | null;
}

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

function HistoryCard({ record }: { record: CompletedEcgRecord }) {
  const displayDate = record.interpreted_at ?? record.updated_at;

  return (
    <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-zinc-800 shadow-sm shadow-gray-100 dark:shadow-none">
      {/* Ligne 1 : référence + badge */}
      <View className="flex-row items-center justify-between mb-2">
        <Text
          className="text-sm font-semibold text-gray-900 dark:text-zinc-100 flex-1 mr-2"
          numberOfLines={1}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {record.reference}
        </Text>
        <View
          style={{
            backgroundColor: record.is_normal === false ? '#fee2e2' : '#dcfce7',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 20,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '700',
              color: record.is_normal === false ? '#dc2626' : '#16a34a',
            }}
          >
            {record.is_normal === false ? 'Anomalie' : 'Normal'}
          </Text>
        </View>
      </View>

      {/* Date d'interprétation */}
      <View className="flex-row items-center gap-1.5 mb-2">
        <Ionicons name="time-outline" size={12} color="#9ca3af" />
        <Text className="text-[11px] text-gray-400 dark:text-zinc-500">
          {formatDateTime(displayDate)}
        </Text>
      </View>

      {/* Conclusion */}
      {!!record.conclusion && (
        <Text
          className="text-xs text-gray-500 dark:text-zinc-400 mb-2"
          style={{ fontStyle: 'italic' }}
          numberOfLines={2}
        >
          {record.conclusion}
        </Text>
      )}

      {/* Mesures FC / QTc */}
      {(record.heart_rate != null || record.qtc_interval != null) && (
        <View className="flex-row gap-3 mt-1">
          {record.heart_rate != null && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="pulse-outline" size={12} color="#6b7280" />
              <Text className="text-[11px] text-gray-500 dark:text-zinc-400">
                FC {record.heart_rate} bpm
              </Text>
            </View>
          )}
          {record.qtc_interval != null && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="stats-chart-outline" size={12} color="#6b7280" />
              <Text className="text-[11px] text-gray-500 dark:text-zinc-400">
                QTc {record.qtc_interval} ms
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function PatientHistoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { records, loading } = usePatientEcgHistory(id ?? null);

  return (
    <View
      className="flex-1 dark:bg-zinc-950"
      style={{ paddingTop: insets.top, backgroundColor: joyful.screenBg }}
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: joyful.stepBarBg,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 14,
          borderBottomWidth: 2,
          borderBottomColor: joyful.tabBarBorder,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 4, marginRight: 2 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={joyful.primaryDark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            className="text-base font-bold dark:text-violet-200"
            style={{ color: joyful.primaryDark }}
            numberOfLines={1}
          >
            {name ?? 'Patient'}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            Historique ECG interprétés
          </Text>
        </View>
      </View>

      {/* Corps */}
      {loading
        ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#4f46e5" size="large" />
          </View>
        )
        : (
          <ScrollView
            className="flex-1 px-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 30 }}
          >
            {records.length === 0
              ? (
                <View className="items-center mt-16 px-6">
                  <Ionicons name="document-text-outline" size={48} color="#9ca3af" />
                  <Text className="text-gray-500 dark:text-zinc-400 font-medium text-center mt-3">
                    Aucun ECG interprété pour ce patient
                  </Text>
                </View>
              )
              : records.map(record => (
                <HistoryCard key={record.id} record={record as CompletedEcgRecord} />
              ))
            }
          </ScrollView>
        )
      }
    </View>
  );
}
