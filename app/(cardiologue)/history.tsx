/**
 * Historique des ECG terminés — le cardiologue peut revoir le tracé en lecture seule.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useCardiologistQueue } from '@/hooks/useCardiologistQueue';
import { ECGTraceView } from '@/components/ecg/ECGTraceView';
import type { EcgRecordItem } from '@/hooks/useEcgList';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 2) return 'À l\'instant';
  if (mins < 60) return `${mins} min`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}j`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(dateStr));
}

export default function CardiologueHistoryScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);

  const { records, loading, refetch } = useCardiologistQueue(user?.id, 200);

  const completed = useMemo(() => {
    let list = records.filter(r => r.status === 'completed');
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        r =>
          (r.patient_name ?? '').toLowerCase().includes(q)
          || (r.reference ?? '').toLowerCase().includes(q)
          || (r.medical_center ?? '').toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [records, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-950" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <Text className="text-xl font-bold text-gray-900 dark:text-zinc-100">Historique</Text>
        <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
          ECG analysés — tracé consultable en lecture seule
        </Text>
        <TextInput
          className="mt-3 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-zinc-100"
          placeholder="Rechercher patient, référence…"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        className="flex-1 px-4 pt-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={joyful.primary} />
        }
      >
        {loading && completed.length === 0 ? (
          <View className="py-20 items-center">
            <ActivityIndicator color={joyful.primary} size="large" />
          </View>
        ) : completed.length === 0 ? (
          <View className="py-16 items-center">
            <Ionicons name="checkmark-done-outline" size={40} color="#d1d5db" />
            <Text className="text-center text-gray-500 dark:text-zinc-400 text-sm mt-3">
              Aucun ECG terminé trouvé.
            </Text>
          </View>
        ) : (
          completed.map((item: EcgRecordItem) => (
            <View
              key={item.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl mb-3 border border-gray-100 dark:border-zinc-800 overflow-hidden"
            >
              <TouchableOpacity
                className="p-4"
                activeOpacity={0.8}
                onPress={() => router.push(`/(cardiologue)/interpret/${item.id}` as Href)}
              >
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 items-center justify-center mr-3">
                    <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-zinc-100" numberOfLines={1}>
                      {item.patient_name}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      {item.reference} · {item.medical_center} · {timeAgo(item.updated_at)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center justify-center py-1.5 border-t border-gray-50 dark:border-zinc-800"
                onPress={() => setExpandedTrace(prev => prev === item.id ? null : item.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={expandedTrace === item.id ? 'eye-off-outline' : 'pulse-outline'}
                  size={12}
                  color="#6366f1"
                />
                <Text className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 ml-1">
                  {expandedTrace === item.id ? 'Masquer' : 'Aperçu tracé'}
                </Text>
              </TouchableOpacity>

              {expandedTrace === item.id && (
                <View className="px-2 pb-2">
                  <ECGTraceView
                    ecgId={item.id}
                    files={(item as EcgRecordItem & { files?: { id: string; filename: string; file_url?: string; file_type: string }[] }).files}
                    height={150}
                    compact
                  />
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
