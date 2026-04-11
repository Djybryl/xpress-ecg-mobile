import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useCardiologistDashboard } from '@/hooks/useCardiologistDashboard';
import { useCardiologistQueue } from '@/hooks/useCardiologistQueue';
import type { EcgRecordItem } from '@/hooks/useEcgList';

function getFirstName(fullName: string): string {
  const stripped = fullName.replace(/^(\s*(Dr\.?\s+|Pr\.?\s+))+/i, '').trim();
  return stripped.split(' ')[0] ?? stripped;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  if (mins < 2) return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${Math.floor(hours / 24)}j`;
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View className={`flex-1 ${color} rounded-2xl p-4 items-center`}>
      <Text className="text-2xl font-bold text-gray-800 dark:text-zinc-100">{value}</Text>
      <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 text-center">{label}</Text>
    </View>
  );
}

export default function CardiologueHome() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { stats, loading: dashLoading, refetch: refetchDash } = useCardiologistDashboard(!!user?.id);
  const { records, loading: queueLoading, refetch: refetchQueue } = useCardiologistQueue(user?.id, 80);

  const mineToStart = useMemo(
    () => records.filter(
      r => r.assigned_to === user?.id && (r.status === 'assigned' || r.status === 'analyzing'),
    ),
    [records, user?.id],
  );

  const urgentOpen = useMemo(
    () => records.filter(r => r.urgency === 'urgent' && r.status !== 'completed').slice(0, 5),
    [records],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDash(), refetchQueue()]);
    setRefreshing(false);
  }, [refetchDash, refetchQueue]);

  const loading = dashLoading && !stats;

  return (
    <View className="flex-1" style={{ backgroundColor: joyful.screenBg }}>
      <LinearGradient
        colors={[...joyful.gradientCamera]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 28,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <Text className="text-white/80 text-sm font-medium">{getGreeting()}</Text>
        <Text className="text-white text-2xl font-bold mt-1">
          Dr {getFirstName(user?.name ?? 'Cardiologue')}
        </Text>
        <Text className="text-violet-100 text-sm mt-1">Vue d&apos;ensemble — interprétations ECG</Text>
      </LinearGradient>

      <ScrollView
        className="flex-1 -mt-4 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={(
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={joyful.primary} />
        )}
      >
        {loading ? (
          <View className="py-16 items-center">
            <ActivityIndicator color={joyful.primary} size="large" />
          </View>
        ) : stats ? (
          <>
            <View className="flex-row gap-2 mb-3 mt-2">
              <StatCard value={stats.assigned_count} label="Assignés à moi" color="bg-sky-50 dark:bg-sky-950/40" />
              <StatCard value={stats.analyzing_count} label="En analyse" color="bg-indigo-50 dark:bg-indigo-950/40" />
            </View>
            <View className="flex-row gap-2 mb-4">
              <StatCard value={stats.completed_today} label="Terminés aujourd&apos;hui" color="bg-emerald-50 dark:bg-emerald-950/40" />
              <StatCard value={stats.urgent_count} label="Urgences ouvertes" color="bg-rose-50 dark:bg-rose-950/40" />
            </View>

            {stats.pending_second_opinions > 0 && (
              <View className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-4">
                <Text className="text-amber-900 dark:text-amber-100 font-semibold text-sm">
                  Second avis en attente : {stats.pending_second_opinions}
                </Text>
                <Text className="text-amber-800/90 dark:text-amber-200/80 text-xs mt-1">
                  La gestion détaillée des second avis arrive dans une prochaine version.
                </Text>
              </View>
            )}

            {urgentOpen.length > 0 && (
              <View className="mb-4">
                <Text className="text-gray-800 dark:text-zinc-100 font-bold text-base mb-2">Urgences récentes</Text>
                {urgentOpen.map((item: EcgRecordItem) => (
                  <TouchableOpacity
                    key={item.id}
                    className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-2 border border-red-100 dark:border-red-900/50"
                    activeOpacity={0.85}
                    onPress={() => router.push(`/(cardiologue)/interpret/${item.id}` as Href)}
                  >
                    <Text className="text-gray-900 dark:text-zinc-100 font-semibold text-sm" numberOfLines={1}>
                      {item.patient_name} ⚡
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-1">{item.reference} · {timeAgo(item.created_at)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-base">Mes dossiers actifs</Text>
              <TouchableOpacity onPress={() => router.push('/(cardiologue)/queue' as Href)}>
                <Text className="text-sm font-semibold" style={{ color: joyful.primary }}>Voir la file</Text>
              </TouchableOpacity>
            </View>
            {queueLoading && mineToStart.length === 0 ? (
              <ActivityIndicator color={joyful.primary} className="py-4" />
            ) : mineToStart.length === 0 ? (
              <Text className="text-gray-500 dark:text-zinc-400 text-sm py-2">Aucun dossier assigné en cours.</Text>
            ) : (
              mineToStart.slice(0, 5).map((item: EcgRecordItem) => (
                <TouchableOpacity
                  key={item.id}
                  className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-2 border border-gray-100 dark:border-zinc-800"
                  activeOpacity={0.85}
                  onPress={() => router.push(`/(cardiologue)/interpret/${item.id}` as Href)}
                >
                  <Text className="text-gray-900 dark:text-zinc-100 font-semibold text-sm" numberOfLines={1}>
                    {item.patient_name}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    {item.reference} · {item.status === 'analyzing' ? 'En analyse' : 'Assigné'} · {timeAgo(item.updated_at)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
