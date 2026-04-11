import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useEcgList, type EcgRecordItem } from '@/hooks/useEcgList';
import { useReportList, type ReportItem } from '@/hooks/useReportList';
import { useEconomyMe } from '@/hooks/useEconomyMe';

/**
 * Supprime le préfixe de titre médical (Dr, Dr., Pr, Pr.) en début de nom,
 * puis retourne le premier prénom — évite "Dr. Dr. Jean" si le nom contient déjà "Dr.".
 */
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

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(dateStr));
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

function StatusBadge({ status }: { status: EcgRecordItem['status'] }) {
  const config = {
    pending:    { label: 'En attente',  bg: 'bg-amber-100',  text: 'text-amber-700' },
    assigned:   { label: 'Assigné',     bg: 'bg-blue-100',   text: 'text-blue-700' },
    analyzing:  { label: 'En analyse',  bg: 'bg-blue-100',   text: 'text-blue-700' },
    completed:  { label: 'Terminé',     bg: 'bg-green-100',  text: 'text-green-700' },
    validated:  { label: 'Validé',      bg: 'bg-green-100',  text: 'text-green-700' },
  }[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-600' };

  return (
    <View className={`${config.bg} px-2 py-0.5 rounded-full`}>
      <Text className={`${config.text} text-[11px] font-medium`}>{config.label}</Text>
    </View>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View className={`flex-1 ${color} rounded-2xl p-4 items-center`}>
      <Text className="text-2xl font-bold text-gray-800 dark:text-zinc-100">{value}</Text>
      <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 text-center">{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const {
    records: ecgRecords, loading: ecgLoading, refetch: refetchEcg,
  } = useEcgList({
    referring_doctor_id: user?.id,
    limit: 50,
    enabled: !!user?.id,
  });

  const {
    reports, unreadCount, urgentUnreadCount, loading: reportsLoading, refetch: refetchReports,
  } = useReportList({
    referring_doctor_id: user?.id,
    enabled: !!user?.id,
  });

  const { data: economy, refetch: refetchEconomy } = useEconomyMe(!!user?.id);

  const ecgUsed      = economy?.quota?.ecg_used ?? economy?.subscription?.ecg_used_this_month ?? 0;
  const ecgLimit     = economy?.quota?.ecg_limit ?? economy?.subscription?.monthly_ecg_quota ?? 0;
  const ecgRemaining = economy?.gate?.remaining ?? Math.max(0, ecgLimit - ecgUsed);
  const isFreeQuota  = economy != null && economy.accessLevel === 'GRATUIT' && ecgLimit > 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchEcg(), refetchReports(), refetchEconomy()]);
    setRefreshing(false);
  }, [refetchEcg, refetchReports, refetchEconomy]);

  const pendingCount  = ecgRecords.filter(e => e.status === 'pending').length;
  const analyzingCount = ecgRecords.filter(e => e.status === 'analyzing' || e.status === 'assigned').length;
  const completedCount = ecgRecords.filter(e => e.status === 'completed' || e.status === 'validated').length;

  const urgentUnread: ReportItem[] = reports.filter(r => !r.is_read && r.is_urgent).slice(0, 3);
  const recentRequests: EcgRecordItem[] = ecgRecords.slice(0, 4);
  const recentReports: ReportItem[] = reports.filter(r => !r.is_read).slice(0, 3);

  const isLoading = ecgLoading || reportsLoading;

  return (
    <View className="flex-1 dark:bg-zinc-950" style={{ paddingTop: insets.top, backgroundColor: joyful.screenBg }}>
      {/* Header */}
      <LinearGradient
        colors={[...joyful.gradientCamera]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}
      >
        <View className="flex-row items-center justify-between mb-1">
          <View>
            <Text className="text-indigo-200 text-sm">
              {getGreeting()} 👋
            </Text>
            <Text className="text-white text-xl font-bold">
              Dr. {user ? getFirstName(user.name) : '…'}
            </Text>
          </View>
          <View className="items-end">
            {urgentUnreadCount > 0 && (
              <TouchableOpacity
                className="bg-red-500 rounded-full px-3 py-1 flex-row items-center gap-1"
                onPress={() => router.push('/(tabs)/reports')}
              >
                <Text className="text-white text-xs font-bold">
                  🔴 {urgentUnreadCount} urgent{urgentUnreadCount > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            )}
            {unreadCount > 0 && urgentUnreadCount === 0 && (
              <View className="bg-white/20 rounded-full px-3 py-1">
                <Text className="text-white text-xs font-medium">
                  {unreadCount} rapport{unreadCount > 1 ? 's' : ''} non lu{unreadCount > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1 -mt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
        }
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* Stats */}
        <View className="bg-white dark:bg-zinc-900 mx-4 rounded-2xl p-4 shadow-sm shadow-gray-200 dark:shadow-none border border-gray-100 dark:border-zinc-800">
          {isLoading
            ? <ActivityIndicator color="#4f46e5" size="small" />
            : (
              <View className="flex-row gap-3">
                <StatCard value={pendingCount}   label="En attente"  color="bg-amber-50" />
                <StatCard value={analyzingCount} label="En analyse"  color="bg-blue-50" />
                <StatCard value={completedCount} label="Terminés"    color="bg-green-50" />
                <StatCard value={unreadCount}    label="Non lus"     color="bg-indigo-50" />
              </View>
            )
          }
        </View>

        {/* Quota ECG mensuel — plan gratuit uniquement */}
        {isFreeQuota && (
          <View className="mx-4 mt-3">
            <View
              className={`rounded-2xl px-4 py-3 flex-row items-center gap-3 border ${
                ecgRemaining <= 0
                  ? 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900'
                  : ecgRemaining <= 3
                  ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900'
                  : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900'
              }`}
            >
              <Text className="text-2xl">
                {ecgRemaining <= 0 ? '🚫' : ecgRemaining <= 3 ? '⚠️' : '✅'}
              </Text>
              <View className="flex-1">
                <Text className={`text-sm font-bold ${
                  ecgRemaining <= 0 ? 'text-red-700 dark:text-red-400'
                  : ecgRemaining <= 3 ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
                }`}>
                  {ecgRemaining <= 0
                    ? 'Quota mensuel épuisé'
                    : `${ecgRemaining} demande${ecgRemaining > 1 ? 's' : ''} restante${ecgRemaining > 1 ? 's' : ''} ce mois`}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                  {ecgUsed} / {ecgLimit} ECG utilisés · Compte gratuit
                </Text>
              </View>
              {ecgRemaining <= 0 && (
                <TouchableOpacity
                  className="bg-indigo-600 rounded-xl px-3 py-1.5"
                  onPress={() => router.push('/(tabs)/profile')}
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-xs font-semibold">Voir offres</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Alertes urgentes */}
        {urgentUnread.length > 0 && (
          <View className="mx-4 mt-4">
            <Text className="text-sm font-semibold text-gray-700 dark:text-zinc-200 mb-2">🔴 Rapports urgents</Text>
            {urgentUnread.map(report => (
              <TouchableOpacity
                key={report.id}
                className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2 flex-row items-center"
                onPress={() => router.push('/(tabs)/reports')}
                activeOpacity={0.8}
              >
                <View className="w-9 h-9 rounded-full bg-red-100 items-center justify-center mr-3">
                  <Text className="text-sm font-bold text-red-600">
                    {(report.patient_name ?? 'P').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-red-800" numberOfLines={1}>
                    {report.patient_name ?? 'Patient inconnu'} ⚡
                  </Text>
                  <Text className="text-xs text-red-600">
                    {timeAgo(report.updated_at)} · {report.cardiologist_name ?? 'Cardiologue'}
                  </Text>
                </View>
                <Text className="text-gray-400 dark:text-zinc-500 text-base">›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Demandes récentes */}
        {recentRequests.length > 0 && (
          <View className="mx-4 mt-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Demandes récentes</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/requests')}>
                <Text className="text-indigo-600 dark:text-violet-400 text-xs">Voir tout</Text>
              </TouchableOpacity>
            </View>
            <View className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm shadow-gray-100 dark:shadow-none">
              {recentRequests.map((item, index) => (
                <View key={item.id}>
                  {index > 0 && <View className="h-px bg-gray-100 dark:bg-zinc-800 mx-4" />}
                  <View className="flex-row items-center px-4 py-3">
                    <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mr-3">
                      <Text className="text-xs font-bold text-indigo-600 dark:text-violet-400">
                        {(item.patient_name ?? 'P').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-medium text-gray-900 dark:text-zinc-100" numberOfLines={1}>
                        {item.patient_name}
                        {item.urgency === 'urgent' && ' ⚡'}
                      </Text>
                      <Text className="text-xs text-gray-500 dark:text-zinc-400">
                        {item.reference} · {timeAgo(item.created_at)}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Rapports non lus récents */}
        {recentReports.length > 0 && (
          <View className="mx-4 mt-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Rapports non lus</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/reports')}>
                <Text className="text-indigo-600 dark:text-violet-400 text-xs">Voir tout</Text>
              </TouchableOpacity>
            </View>
            <View className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm shadow-gray-100 dark:shadow-none">
              {recentReports.map((report, index) => (
                <View key={report.id}>
                  {index > 0 && <View className="h-px bg-gray-100 dark:bg-zinc-800 mx-4" />}
                  <TouchableOpacity
                    className="flex-row items-center px-4 py-3"
                    onPress={() => router.push('/(tabs)/reports')}
                    activeOpacity={0.7}
                  >
                    <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center mr-3">
                      <Text className="text-xs font-bold text-green-700">
                        {(report.patient_name ?? 'P').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-medium text-gray-900 dark:text-zinc-100" numberOfLines={1}>
                        {report.patient_name ?? 'Patient inconnu'}
                      </Text>
                      <Text className="text-xs text-gray-500 dark:text-zinc-400">
                        {timeAgo(report.updated_at)} · {report.cardiologist_name ?? 'Cardiologue'}
                      </Text>
                    </View>
                    <View className={`px-2 py-0.5 rounded-full ${report.is_normal ? 'bg-green-100' : 'bg-red-100'}`}>
                      <Text className={`text-[11px] font-medium ${report.is_normal ? 'text-green-700' : 'text-red-700'}`}>
                        {report.is_normal ? 'Normal' : 'Anormal'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bouton Nouvel ECG */}
        <TouchableOpacity
          className="mx-4 mt-5 bg-indigo-600 rounded-2xl py-4 items-center flex-row justify-center gap-2 shadow-md shadow-indigo-300"
          onPress={() => router.push('/(tabs)/new-ecg')}
          activeOpacity={0.85}
          style={{ elevation: 4 }}
        >
          <Text className="text-white text-xl">+</Text>
          <Text className="text-white font-semibold text-base">Nouvelle demande ECG</Text>
        </TouchableOpacity>

        {/* Vide */}
        {!isLoading && ecgRecords.length === 0 && reports.length === 0 && (
          <View className="items-center mt-12 px-8">
            <Text className="text-5xl mb-4">🏥</Text>
            <Text className="text-gray-700 dark:text-zinc-200 text-lg font-semibold text-center">
              Bienvenue sur Xpress ECG
            </Text>
            <Text className="text-gray-500 dark:text-zinc-400 text-sm text-center mt-2 leading-relaxed">
              Déposez votre première demande ECG en appuyant sur le bouton ci-dessus.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
