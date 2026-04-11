import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useAdminDashboard, type ActivityLogItem } from '@/hooks/useAdminDashboard';

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
  const days = Math.floor(hours / 24);
  if (mins < 2) return 'À l\'instant';
  if (mins < 60) return `${mins} min`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}j`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(dateStr));
}

interface StatCardProps {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  onPress?: () => void;
}

function StatCard({ value, label, icon, iconBg, iconColor, onPress }: StatCardProps) {
  const { colors: joyful } = useTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl p-3 shadow-sm"
    >
      <View style={{ backgroundColor: iconBg, width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text className="text-xl font-bold text-gray-900 dark:text-zinc-100">{value}</Text>
      <Text className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5 leading-tight">{label}</Text>
    </Wrapper>
  );
}

function ActivityRow({ log }: { log: ActivityLogItem }) {
  return (
    <View className="flex-row items-center py-3 border-b border-gray-50 dark:border-zinc-800">
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Ionicons name="pulse" size={14} color="#7c3aed" />
      </View>
      <View style={{ flex: 1 }}>
        <Text className="text-[13px] font-semibold text-gray-800 dark:text-zinc-200" numberOfLines={1}>
          {log.action}
        </Text>
        <Text className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
          {log.id.slice(0, 8)} · {timeAgo(log.updated_at)}
        </Text>
      </View>
    </View>
  );
}

export default function AdminHome() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { stats, logs, loading, refetch } = useAdminDashboard(!!user);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const name = user?.name ?? 'Admin';

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-zinc-950"
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={joyful.primary} />}
    >
      {/* Header gradient */}
      <LinearGradient
        colors={[...joyful.gradientCamera]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 12, paddingBottom: 32, paddingHorizontal: 24 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text className="text-white/80 text-sm font-medium">{getGreeting()},</Text>
            <Text className="text-white text-2xl font-bold mt-1">{name}</Text>
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                <Text className="text-white text-[11px] font-bold">Administrateur</Text>
              </View>
            </View>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="shield-checkmark" size={20} color="#fff" />
          </View>
        </View>
      </LinearGradient>

      <View style={{ marginTop: -16, paddingHorizontal: 16 }}>
        {/* Stats globales */}
        <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
            Vue globale
          </Text>
          {loading && !stats ? (
            <ActivityIndicator color={joyful.primary} style={{ paddingVertical: 16 }} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <StatCard
                  value={stats?.total_users ?? 0}
                  label="Utilisateurs actifs"
                  icon="people"
                  iconBg="#dbeafe"
                  iconColor="#1d4ed8"
                  onPress={() => router.push('/(admin)/users' as Href)}
                />
                <StatCard
                  value={stats?.total_hospitals ?? 0}
                  label="Hôpitaux actifs"
                  icon="business"
                  iconBg="#d1fae5"
                  iconColor="#065f46"
                />
                <StatCard
                  value={stats?.pending_ecg ?? 0}
                  label="ECG en attente"
                  icon="hourglass"
                  iconBg="#fef3c7"
                  iconColor="#d97706"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <StatCard
                  value={stats?.total_ecg_today ?? 0}
                  label="ECG aujourd'hui"
                  icon="today"
                  iconBg="#ede9fe"
                  iconColor="#7c3aed"
                />
                <StatCard
                  value={stats?.total_ecg_month ?? 0}
                  label="ECG ce mois"
                  icon="calendar"
                  iconBg="#fce7f3"
                  iconColor="#be185d"
                />
                <StatCard
                  value={stats?.completed_ecg ?? 0}
                  label="ECG terminés"
                  icon="checkmark-circle"
                  iconBg="#f0fdf4"
                  iconColor="#166534"
                />
              </View>
            </>
          )}
        </View>

        {/* Quick actions */}
        <Text className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
          Accès rapides
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(admin)/users' as Href)}
            className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl p-4 items-center shadow-sm"
          >
            <View style={{ backgroundColor: '#dbeafe', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Ionicons name="people" size={20} color="#1d4ed8" />
            </View>
            <Text className="text-[12px] font-bold text-gray-800 dark:text-zinc-100 text-center">Utilisateurs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(admin)/prescribers' as Href)}
            className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl p-4 items-center shadow-sm"
          >
            <View style={{ backgroundColor: '#fef3c7', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Ionicons name="document-text" size={20} color="#d97706" />
            </View>
            <Text className="text-[12px] font-bold text-gray-800 dark:text-zinc-100 text-center">Dossiers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(admin)/settings' as Href)}
            className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl p-4 items-center shadow-sm"
          >
            <View style={{ backgroundColor: '#f1f5f9', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Ionicons name="settings" size={20} color="#475569" />
            </View>
            <Text className="text-[12px] font-bold text-gray-800 dark:text-zinc-100 text-center">Paramètres</Text>
          </TouchableOpacity>
        </View>

        {/* Activity logs */}
        {logs.length > 0 && (
          <View className="bg-white dark:bg-zinc-900 rounded-2xl px-4 pt-4 pb-2 shadow-sm">
            <Text className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
              Activité récente
            </Text>
            {logs.slice(0, 10).map(log => (
              <ActivityRow key={log.id} log={log} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
