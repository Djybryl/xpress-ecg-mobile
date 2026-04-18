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
import { useSecretaireDashboard } from '@/hooks/useSecretaireDashboard';
import { useEcgValidationQueue } from '@/hooks/useEcgValidationQueue';

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

function StatCard({
  value, label, icon, onPress,
}: {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const { colors: joyful } = useTheme();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl p-4 items-center"
    >
      <Ionicons name={icon} size={18} color={joyful.primary} style={{ marginBottom: 4 }} />
      <Text className="text-2xl font-bold text-gray-800 dark:text-zinc-100">{value}</Text>
      <Text className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5 text-center">{label}</Text>
    </Wrapper>
  );
}

export default function SecretaireHome() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const hospitalId = user?.hospitalId ?? null;
  const { stats, loading: dashLoading, refetch: refetchDash } = useSecretaireDashboard(!!user, hospitalId);
  const { records: pendingRecords, loading: queueLoading, refetch: refetchQueue } = useEcgValidationQueue(
    'pending',
    10,
    hospitalId,
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchDash(), refetchQueue()]);
    setRefreshing(false);
  };

  const isLoading = dashLoading || queueLoading;
  const firstName = user?.name ? getFirstName(user.name) : 'Secrétaire';

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
            <Text className="text-white text-2xl font-bold mt-1">{firstName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                <Text className="text-white text-[11px] font-bold">Secrétaire</Text>
              </View>
            </View>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="briefcase" size={20} color="#fff" />
          </View>
        </View>
      </LinearGradient>

      <View style={{ marginTop: -16, paddingHorizontal: 16 }}>
        {!hospitalId && (
          <View className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 mb-3">
            <Text className="text-[12px] text-amber-900 dark:text-amber-100">
              Aucun établissement n&apos;est rattaché à votre compte : les compteurs et la file ECG peuvent
              inclure tous les dossiers de la plateforme. Contactez un administrateur pour associer un hôpital.
            </Text>
          </View>
        )}
        {/* Stats card */}
        <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-4 shadow-sm">
          <Text className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
            Tableau de bord
          </Text>
          {isLoading ? (
            <ActivityIndicator color={joyful.primary} style={{ paddingVertical: 16 }} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatCard
                value={stats?.pending_validation ?? 0}
                label="En attente"
                icon="hourglass"
                onPress={() => router.push('/(secretaire)/ecg-queue' as Href)}
              />
              <StatCard
                value={stats?.assigned_today ?? 0}
                label="Assignés auj."
                icon="checkmark-circle"
              />
              <StatCard
                value={stats?.total_today ?? 0}
                label="Total auj."
                icon="pulse"
              />
            </View>
          )}
        </View>

        {/* Quick actions */}
        <Text className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
          Actions rapides
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(secretaire)/ecg-queue' as Href)}
            className="flex-1 min-w-[44%] bg-white dark:bg-zinc-900 rounded-2xl p-4 items-center shadow-sm"
          >
            <View style={{ backgroundColor: '#fef3c7', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Ionicons name="list" size={20} color="#d97706" />
            </View>
            <Text className="text-[12px] font-bold text-gray-800 dark:text-zinc-100 text-center">File ECG</Text>
            <Text className="text-[10px] text-gray-500 dark:text-zinc-400 mt-1 text-center">Valider les demandes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(secretaire)/prescribers' as Href)}
            className="flex-1 min-w-[44%] bg-white dark:bg-zinc-900 rounded-2xl p-4 items-center shadow-sm"
          >
            <View style={{ backgroundColor: '#ede9fe', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Ionicons name="people" size={20} color="#7c3aed" />
            </View>
            <Text className="text-[12px] font-bold text-gray-800 dark:text-zinc-100 text-center">Prescripteurs</Text>
            <Text className="text-[10px] text-gray-500 dark:text-zinc-400 mt-1 text-center">Dossiers en attente</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(secretaire)/subscriptions' as Href)}
            className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl p-4 flex-row items-center shadow-sm"
          >
            <View style={{ backgroundColor: '#e0e7ff', width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="pie-chart" size={20} color="#4338ca" />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-[12px] font-bold text-gray-800 dark:text-zinc-100">Quota & abonnement</Text>
              <Text className="text-[10px] text-gray-500 dark:text-zinc-400 mt-0.5">Vue lecture seule</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Pending ECG list preview */}
        {pendingRecords.length > 0 && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">
                ECG en attente
              </Text>
              <TouchableOpacity onPress={() => router.push('/(secretaire)/ecg-queue' as Href)}>
                <Text style={{ fontSize: 12, color: joyful.primary, fontWeight: '700' }}>Voir tout →</Text>
              </TouchableOpacity>
            </View>
            {pendingRecords.slice(0, 5).map(record => (
              <TouchableOpacity
                key={record.id}
                activeOpacity={0.85}
                onPress={() => router.push('/(secretaire)/ecg-queue' as Href)}
                className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-2 flex-row items-center shadow-sm"
              >
                <View style={{ backgroundColor: '#fef3c7', width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons name="document-text" size={18} color="#d97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-[13px] font-bold text-gray-800 dark:text-zinc-100" numberOfLines={1}>
                    {record.patient_name ?? 'Patient inconnu'}
                  </Text>
                  <Text className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                    {record.reference ?? record.id.slice(0, 8)} · {record.medical_center ?? '—'}
                  </Text>
                </View>
                {record.urgency === 'urgent' && (
                  <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#dc2626' }}>URGENT</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
