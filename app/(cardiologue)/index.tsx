import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useSolidarityEligibility } from '@/hooks/useSolidarityEligibility';
import { useNotifications } from '@/hooks/useNotifications';
import { useCrcAccount } from '@/hooks/useCrcAccount';
import { api } from '@/lib/apiClient';
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

function StatCard({
  value, label, color, onPress, hint,
}: {
  value: number;
  label: string;
  color: string;
  onPress?: () => void;
  hint?: string;
}) {
  return (
    <TouchableOpacity
      className={`flex-1 ${color} rounded-2xl p-4 items-center`}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityLabel={`${label} : ${value}`}
      accessibilityHint={hint ?? (onPress ? 'Appuyez pour voir la liste' : undefined)}
      accessibilityRole={onPress ? 'button' : 'text'}
    >
      <Text className="text-2xl font-bold text-gray-800 dark:text-zinc-100">{value}</Text>
      <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 text-center">{label}</Text>
      {onPress ? (
        <Text className="text-[9px] text-gray-400 dark:text-zinc-500 mt-1">Voir →</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function UrgentPlatformCard({
  count,
  label,
  onPress,
  hint,
}: {
  count: number;
  label: string;
  onPress?: () => void;
  hint?: string;
}) {
  const canPress = count > 0 && !!onPress;
  return (
    <TouchableOpacity
      className="flex-1 rounded-2xl p-4 items-center justify-center min-h-[92px]"
      style={{ backgroundColor: '#ef4444' }}
      onPress={onPress}
      disabled={!canPress}
      activeOpacity={canPress ? 0.8 : 1}
      accessibilityLabel={`${label} : ${count}`}
      accessibilityHint={hint}
      accessibilityRole={canPress ? 'button' : 'text'}
    >
      <Ionicons name="flash" size={22} color="white" style={{ marginBottom: 4 }} />
      <Text className="text-2xl font-bold text-white">{count}</Text>
      <Text className="text-xs text-center text-white/90 mt-0.5 px-1">{label}</Text>
      {canPress ? (
        <Text className="text-[9px] text-white/80 mt-1">Voir →</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function DeadlineRemaining({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [deadline]);

  const end = new Date(deadline).getTime();
  const ms = end - now;
  if (Number.isNaN(end)) return null;
  if (ms <= 0) {
    return (
      <Text style={{ fontSize: 10, color: '#dc2626', fontWeight: '600', marginTop: 2 }}>
        Échéance dépassée
      </Text>
    );
  }
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const parts = h > 0 ? `${h} h ${m} min` : `${Math.max(0, m)} min`;
  return (
    <Text style={{ fontSize: 10, color: '#d97706', fontWeight: '500', marginTop: 2 }}>
      Temps restant : {parts}
    </Text>
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
  const { data: solidarity, loading: solidarityLoading, refetch: refetchSolidarity } = useSolidarityEligibility(user?.id);
  const { unreadCount: notifCount, refetch: refetchNotifs } = useNotifications(!!user?.id);

  const crcEnabled = user?.role === 'cardiologue';
  const {
    hasCrc,
    solde: crcSolde,
    loading: crcAccountLoading,
    refetch: refetchCrcWallet,
    error: crcAccountError,
  } = useCrcAccount(crcEnabled);
  const [crcQueueCount, setCrcQueueCount] = useState<number | null>(null);

  const loadCrcQueueCount = useCallback(async () => {
    if (!crcEnabled || !hasCrc) {
      setCrcQueueCount(null);
      return;
    }
    try {
      const q = await api.get<unknown[]>('/crc/ecg-queue', { status: 'pending', limit: 50 });
      setCrcQueueCount(Array.isArray(q) ? q.length : 0);
    } catch {
      setCrcQueueCount(0);
    }
  }, [crcEnabled, hasCrc]);

  useEffect(() => {
    void loadCrcQueueCount();
  }, [loadCrcQueueCount]);

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
    await Promise.all([
      refetchDash(),
      refetchQueue(),
      refetchNotifs(),
      refetchSolidarity(),
      refetchCrcWallet(),
      loadCrcQueueCount(),
    ]);
    setRefreshing(false);
  }, [refetchDash, refetchQueue, refetchNotifs, refetchSolidarity, refetchCrcWallet, loadCrcQueueCount]);

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
            <Text className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1.5 mt-2">
              {t.dashboard.sectionPlatform}
            </Text>
            <View className="flex-row gap-2 mb-3">
              <StatCard
                value={stats.demandes_count}
                label={t.dashboard.platformOpenQueue}
                color="bg-slate-50 dark:bg-slate-900/50"
                onPress={() => router.push('/(cardiologue)/queue' as Href)}
                hint={t.dashboard.hintPlatformQueue}
              />
              <UrgentPlatformCard
                count={stats.urgent_count}
                label={t.dashboard.openUrgencies}
                onPress={
                  stats.urgent_count > 0
                    ? () => router.push('/(cardiologue)/queue?filter=urgent' as Href)
                    : undefined
                }
                hint={stats.urgent_count > 0 ? t.dashboard.hintUrgentQueue : undefined}
              />
            </View>

            <Text className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1.5">
              {t.dashboard.sectionMyActivity}
            </Text>
            <View className="flex-row gap-2 mb-3">
              <StatCard
                value={stats.assigned_count}
                label={t.dashboard.assignedToMe}
                color="bg-sky-50 dark:bg-sky-950/40"
                onPress={() => router.push('/(cardiologue)/mes-ecg' as Href)}
                hint="Voir mes ECG assignés"
              />
              <StatCard
                value={stats.completed_today}
                label={t.dashboard.completedToday}
                color="bg-emerald-50 dark:bg-emerald-950/40"
                onPress={() => router.push('/(cardiologue)/history' as Href)}
                hint="Voir l'historique du jour"
              />
            </View>

            <Text className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1.5">
              {t.dashboard.sectionThisWeek}
            </Text>
            <TouchableOpacity
              className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-4 border border-violet-100 dark:border-violet-900/40"
              onPress={() => router.push('/(cardiologue)/commissions' as Href)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${t.dashboard.giveGetWeekTitle}. ${t.dashboard.giveGetSeeRatios}`}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2 flex-1">
                  <Ionicons name="heart-outline" size={20} color="#7c3aed" />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                      {t.dashboard.giveGetWeekTitle}
                    </Text>
                    <Text className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                      {t.dashboard.giveGetWeekSubtitle}
                    </Text>
                  </View>
                </View>
                {solidarityLoading ? (
                  <ActivityIndicator color="#7c3aed" size="small" />
                ) : null}
              </View>
              {solidarity && !solidarityLoading ? (
                <>
                  <View className="h-2 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden mb-2">
                    <View
                      className={solidarity.eligible || solidarity.required === 0 ? 'bg-emerald-500' : 'bg-amber-500'}
                      style={{
                        width:
                          solidarity.required === 0
                            ? '100%'
                            : `${Math.min(100, (solidarity.done / solidarity.required) * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                      }}
                    />
                  </View>
                  <Text className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                    {solidarity.required === 0
                      ? t.dashboard.giveGetWeekDisabled
                      : solidarity.eligible
                        ? `${t.dashboard.giveGetWeekProgress.replace('{{done}}', String(solidarity.done)).replace('{{required}}', String(solidarity.required))} · ${t.dashboard.giveGetWeekMet}`
                        : t.dashboard.giveGetWeekProgress
                            .replace('{{done}}', String(solidarity.done))
                            .replace('{{required}}', String(solidarity.required))}
                  </Text>
                </>
              ) : !solidarityLoading && !solidarity ? (
                <Text className="text-xs text-gray-500 dark:text-zinc-400">
                  {t.dashboard.giveGetWeekSubtitle}
                </Text>
              ) : null}
              <Text className="text-[11px] text-violet-600 dark:text-violet-400 font-semibold mt-2">
                {t.dashboard.giveGetSeeRatios}
              </Text>
            </TouchableOpacity>

            {crcEnabled && !crcAccountLoading && hasCrc && (
              <LinearGradient
                colors={['#4C1D95', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 14, padding: 14, marginBottom: 16 }}
              >
                <Text className="text-white text-base font-bold" accessibilityRole="header">
                  Mon réseau CRC
                </Text>
                <Text className="text-white/90 text-2xl font-extrabold mt-1" accessibilityRole="text">
                  {crcSolde.toLocaleString('fr-FR')} FCFA
                </Text>
                <Text className="text-violet-100 text-sm mt-1" accessibilityRole="text">
                  ECG réseau en attente : {crcQueueCount ?? '—'}
                </Text>
                {crcSolde < 400 ? (
                  <Text className="text-amber-300 text-xs font-semibold mt-2" accessibilityRole="text">
                    Solde faible — recharger
                  </Text>
                ) : null}
                <TouchableOpacity
                  className="mt-3 self-start bg-white/20 px-4 py-2 rounded-xl"
                  onPress={() => router.push('/(cardiologue)/crc/' as Href)}
                  accessibilityRole="button"
                  accessibilityLabel="Accéder au hub réseau CRC"
                >
                  <Text className="text-white font-bold">Accéder →</Text>
                </TouchableOpacity>
              </LinearGradient>
            )}

            {crcEnabled && !crcAccountLoading && !hasCrc && !crcAccountError && (
              <View className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-2xl p-4 mb-4">
                <Text className="text-violet-900 dark:text-violet-100 text-sm font-medium" accessibilityRole="text">
                  Activez votre réseau CRC · 10 000 FCFA d&apos;inscription
                </Text>
                <TouchableOpacity
                  className="mt-3 bg-violet-600 rounded-xl py-3 items-center"
                  onPress={() => router.push('/(cardiologue)/crc/register' as Href)}
                  accessibilityRole="button"
                  accessibilityLabel="S&apos;inscrire au réseau CRC"
                >
                  <Text className="text-white font-bold">Activer →</Text>
                </TouchableOpacity>
              </View>
            )}

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
                  {myActiveEcg.deadline ? (
                    <>
                      <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '600', marginTop: 2 }}>
                        ⏱ Deadline :{' '}
                        {new Date(myActiveEcg.deadline).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      <DeadlineRemaining deadline={myActiveEcg.deadline} />
                    </>
                  ) : null}
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
