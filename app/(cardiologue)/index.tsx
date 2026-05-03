import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useCardiologistDashboard } from '@/hooks/useCardiologistDashboard';
import { useCardiologistQueue } from '@/hooks/useCardiologistQueue';
import { useNotifications } from '@/hooks/useNotifications';
import { ECGTraceView } from '@/components/ecg/ECGTraceView';
import { useTranslation } from '@/i18n';
import type { EcgRecordItem } from '@/hooks/useEcgList';

function getFirstName(fullName: string): string {
  const stripped = fullName.replace(/^(\s*(Dr\.?\s+|Pr\.?\s+))+/i, '').trim();
  return stripped.split(' ')[0] ?? stripped;
}

function getGreeting(t: { morning: string; afternoon: string; evening: string }): string {
  const h = new Date().getHours();
  if (h < 12) return t.morning;
  if (h < 18) return t.afternoon;
  return t.evening;
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
    <View
      className={`flex-1 ${color} rounded-2xl p-4 items-center`}
      accessibilityLabel={`${label} : ${value}`}
      accessibilityRole="text"
    >
      <Text className="text-2xl font-bold text-gray-800 dark:text-zinc-100" aria-hidden>{value}</Text>
      <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 text-center" aria-hidden>{label}</Text>
    </View>
  );
}

export default function CardiologueHome() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { stats, loading: dashLoading, refetch: refetchDash } = useCardiologistDashboard(!!user?.id);
  const { records, loading: queueLoading, refetch: refetchQueue } = useCardiologistQueue(user?.id, 80);
  const { unreadCount: notifCount, refetch: refetchNotifs } = useNotifications(!!user?.id);

  const mineToStart = useMemo(
    () =>
      records.filter(
        r =>
          r.assigned_to === user?.id &&
          (r.status === 'pending' || r.status === 'validated' || r.status === 'assigned' || r.status === 'analyzing'),
      ),
    [records, user?.id],
  );

  const myActiveEcg = useMemo(
    () => mineToStart.find(r => r.status === 'analyzing') ?? null,
    [mineToStart],
  );

  const otherAssigned = useMemo(
    () => mineToStart.filter(r => r.id !== myActiveEcg?.id),
    [mineToStart, myActiveEcg],
  );

  const urgentOpen = useMemo(
    () => records.filter(r => r.urgency === 'urgent' && r.status !== 'completed').slice(0, 5),
    [records],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDash(), refetchQueue(), refetchNotifs()]);
    setRefreshing(false);
  }, [refetchDash, refetchQueue, refetchNotifs]);

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
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-white/80 text-sm font-medium">{getGreeting(t.dashboard.greeting)}</Text>
            <Text className="text-white text-2xl font-bold mt-1">
              Dr {getFirstName(user?.name ?? 'Cardiologue')}
            </Text>
            <Text className="text-violet-100 text-sm mt-1">{t.dashboard.overview}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(cardiologue)/notifications' as Href)}
            className="relative mt-1"
            activeOpacity={0.7}
            accessibilityLabel={notifCount > 0 ? `Notifications, ${notifCount} non lues` : 'Notifications'}
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={24} color="rgba(255,255,255,0.9)" />
            {notifCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 items-center justify-center">
                <Text className="text-white text-[8px] font-bold">{notifCount > 9 ? '9+' : notifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
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
              <StatCard value={stats.assigned_count} label={t.dashboard.assignedToMe} color="bg-sky-50 dark:bg-sky-950/40" />
              <StatCard value={stats.analyzing_count} label={t.dashboard.analyzing} color="bg-indigo-50 dark:bg-indigo-950/40" />
            </View>
            <View className="flex-row gap-2 mb-4">
              <StatCard value={stats.completed_today} label={t.dashboard.completedToday} color="bg-emerald-50 dark:bg-emerald-950/40" />
              <StatCard value={stats.urgent_count} label={t.dashboard.openUrgencies} color="bg-rose-50 dark:bg-rose-950/40" />
            </View>

            {/* ─── Carte « Mon ECG en cours » ───────────────── */}
            {myActiveEcg && (
              <TouchableOpacity
                className="mb-4 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border-2 border-indigo-300 dark:border-indigo-700"
                activeOpacity={0.85}
                onPress={() => router.push(`/(cardiologue)/interpret/${myActiveEcg.id}` as Href)}
              >
                <View className="bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2.5 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <Text className="text-indigo-800 dark:text-indigo-200 text-xs font-bold uppercase tracking-wide">
                      {t.dashboard.currentEcg}
                    </Text>
                  </View>
                  <View className="bg-indigo-500 rounded-full px-2.5 py-1">
                    <Text className="text-white text-[10px] font-bold">{t.dashboard.continue}</Text>
                  </View>
                </View>
                <View className="px-4 pt-2 pb-1">
                  <Text className="text-gray-900 dark:text-zinc-100 font-bold text-sm" numberOfLines={1}>
                    {myActiveEcg.patient_name}
                    {myActiveEcg.urgency === 'urgent' ? ' ⚡' : ''}
                  </Text>
                  <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    {myActiveEcg.reference} · {myActiveEcg.medical_center}
                  </Text>
                </View>
                <View className="px-2 pb-2">
                  <ECGTraceView
                    ecgId={myActiveEcg.id}
                    files={(myActiveEcg as EcgRecordItem & { files?: { id: string; filename: string; file_url?: string; file_type: string }[] }).files}
                    height={140}
                    compact
                  />
                </View>
              </TouchableOpacity>
            )}

            {stats.pending_second_opinions > 0 && (
              <View className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-4">
                <Text className="text-amber-900 dark:text-amber-100 font-semibold text-sm">
                  {t.dashboard.secondOpinionPending} : {stats.pending_second_opinions}
                </Text>
                <Text className="text-amber-800/90 dark:text-amber-200/80 text-xs mt-1">
                  La gestion détaillée des second avis arrive dans une prochaine version.
                </Text>
              </View>
            )}

            {urgentOpen.length > 0 && (
              <View className="mb-4">
                <Text className="text-gray-800 dark:text-zinc-100 font-bold text-base mb-2">{t.dashboard.recentUrgencies}</Text>
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
              <Text className="text-gray-800 dark:text-zinc-100 font-bold text-base">{t.dashboard.myActiveFiles}</Text>
              <TouchableOpacity onPress={() => router.push('/(cardiologue)/queue' as Href)}>
                <Text className="text-sm font-semibold" style={{ color: joyful.primary }}>{t.dashboard.viewQueue}</Text>
              </TouchableOpacity>
            </View>
            {queueLoading && otherAssigned.length === 0 && !myActiveEcg ? (
              <ActivityIndicator color={joyful.primary} className="py-4" />
            ) : otherAssigned.length === 0 ? (
              <Text className="text-gray-500 dark:text-zinc-400 text-sm py-2">
                {t.dashboard.noActiveFiles}
              </Text>
            ) : (
              otherAssigned.slice(0, 5).map((item: EcgRecordItem) => (
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
                    {item.reference} · {item.status === 'analyzing' ? t.status.analyzing : t.status.assigned} · {timeAgo(item.updated_at)}
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
