import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useEcgList, type EcgRecordItem } from '@/hooks/useEcgList';
import { useReportList, type ReportItem } from '@/hooks/useReportList';

function getFirstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
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
      <Text className="text-2xl font-bold text-gray-800">{value}</Text>
      <Text className="text-xs text-gray-500 mt-0.5 text-center">{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchEcg(), refetchReports()]);
    setRefreshing(false);
  }, [refetchEcg, refetchReports]);

  const pendingCount  = ecgRecords.filter(e => e.status === 'pending').length;
  const analyzingCount = ecgRecords.filter(e => e.status === 'analyzing' || e.status === 'assigned').length;
  const completedCount = ecgRecords.filter(e => e.status === 'completed' || e.status === 'validated').length;

  const urgentUnread: ReportItem[] = reports.filter(r => !r.is_read && r.is_urgent).slice(0, 3);
  const recentRequests: EcgRecordItem[] = ecgRecords.slice(0, 4);
  const recentReports: ReportItem[] = reports.filter(r => !r.is_read).slice(0, 3);

  const isLoading = ecgLoading || reportsLoading;

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-indigo-600 px-5 pt-4 pb-6">
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
      </View>

      <ScrollView
        className="flex-1 -mt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
        }
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* Stats */}
        <View className="bg-white mx-4 rounded-2xl p-4 shadow-sm shadow-gray-200">
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

        {/* Alertes urgentes */}
        {urgentUnread.length > 0 && (
          <View className="mx-4 mt-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">🔴 Rapports urgents</Text>
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
                <Text className="text-gray-400 text-base">›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Demandes récentes */}
        {recentRequests.length > 0 && (
          <View className="mx-4 mt-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-gray-700">Demandes récentes</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/requests')}>
                <Text className="text-indigo-600 text-xs">Voir tout</Text>
              </TouchableOpacity>
            </View>
            <View className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm shadow-gray-100">
              {recentRequests.map((item, index) => (
                <View key={item.id}>
                  {index > 0 && <View className="h-px bg-gray-100 mx-4" />}
                  <View className="flex-row items-center px-4 py-3">
                    <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mr-3">
                      <Text className="text-xs font-bold text-indigo-600">
                        {(item.patient_name ?? 'P').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
                        {item.patient_name}
                        {item.urgency === 'urgent' && ' ⚡'}
                      </Text>
                      <Text className="text-xs text-gray-500">
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
              <Text className="text-sm font-semibold text-gray-700">Rapports non lus</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/reports')}>
                <Text className="text-indigo-600 text-xs">Voir tout</Text>
              </TouchableOpacity>
            </View>
            <View className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm shadow-gray-100">
              {recentReports.map((report, index) => (
                <View key={report.id}>
                  {index > 0 && <View className="h-px bg-gray-100 mx-4" />}
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
                      <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
                        {report.patient_name ?? 'Patient inconnu'}
                      </Text>
                      <Text className="text-xs text-gray-500">
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
            <Text className="text-gray-700 text-lg font-semibold text-center">
              Bienvenue sur Xpress ECG
            </Text>
            <Text className="text-gray-500 text-sm text-center mt-2 leading-relaxed">
              Déposez votre première demande ECG en appuyant sur le bouton ci-dessus.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
