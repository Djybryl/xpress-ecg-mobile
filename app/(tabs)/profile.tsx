import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useEcgList } from '@/hooks/useEcgList';
import { useReportList } from '@/hooks/useReportList';
import { api } from '@/lib/apiClient';

interface EconomyData {
  quota_total: number;
  quota_used: number;
  quota_remaining: number;
  subscription_plan?: string;
  subscription_status?: string;
}

function SettingRow({
  icon, label, value, onPress, dangerous,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  dangerous?: boolean;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3.5"
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View className="w-8 items-center mr-3">
        <Text className="text-lg">{icon}</Text>
      </View>
      <Text className={`flex-1 text-sm ${dangerous ? 'text-red-600' : 'text-gray-800'} font-medium`}>
        {label}
      </Text>
      {value && <Text className="text-xs text-gray-400 mr-2">{value}</Text>}
      {onPress && <Text className="text-gray-300 text-base">›</Text>}
    </TouchableOpacity>
  );
}

function Divider() {
  return <View className="h-px bg-gray-100 mx-4" />;
}

export default function ProfileScreen() {
  const { user, logout, isBiometricAvailable, isBiometricEnrolled } = useAuth();
  const insets = useSafeAreaInsets();
  const [loggingOut, setLoggingOut] = useState(false);
  const [economy, setEconomy] = useState<EconomyData | null>(null);
  const [economyLoading, setEconomyLoading] = useState(false);

  const { records } = useEcgList({ referring_doctor_id: user?.id, limit: 200, enabled: !!user?.id });
  const { reports } = useReportList({ referring_doctor_id: user?.id, limit: 200, enabled: !!user?.id });

  const loadEconomy = useCallback(async () => {
    if (economy || economyLoading) return;
    setEconomyLoading(true);
    try {
      const data = await api.get<EconomyData>('/economy/me');
      setEconomy(data);
    } catch { /* ignore */ }
    finally { setEconomyLoading(false); }
  }, [economy, economyLoading]);

  useState(() => { void loadEconomy(); });

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Déconnexion',
      'Souhaitez-vous vous déconnecter de Xpress ECG ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  }, [logout]);

  const handleRgpdDelete = useCallback(() => {
    Alert.alert(
      '⚠️ Suppression des données',
      'Demander la suppression de toutes vos données personnelles ? Cette action est irréversible. Un email de confirmation vous sera envoyé.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Demander la suppression',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/users/request-deletion');
              Alert.alert('Demande enregistrée', 'Vous recevrez une confirmation par email sous 72h.');
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'envoyer la demande.');
            }
          },
        },
      ],
    );
  }, []);

  const totalEcg    = records.length;
  const pendingEcg  = records.filter(r => r.status === 'pending').length;
  const unreadReports = reports.filter(r => !r.is_read).length;

  const quotaPercent = economy
    ? Math.round((economy.quota_used / (economy.quota_total || 1)) * 100)
    : null;

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header profil */}
        <View className="bg-indigo-700 px-5 pt-6 pb-10">
          <View className="w-16 h-16 rounded-2xl bg-white/20 items-center justify-center mb-3">
            <Text className="text-white text-2xl font-bold">
              {user ? user.name.slice(0, 2).toUpperCase() : 'ME'}
            </Text>
          </View>
          <Text className="text-white text-xl font-bold">{user?.name ?? '—'}</Text>
          <Text className="text-indigo-200 text-sm mt-0.5">{user?.email ?? '—'}</Text>
          <View className="flex-row items-center mt-2 gap-2">
            <View className="bg-white/20 rounded-full px-3 py-0.5">
              <Text className="text-white text-xs">Médecin prescripteur</Text>
            </View>
            {user?.prescriberGateStatus === 'verified' && (
              <View className="bg-green-500/80 rounded-full px-3 py-0.5">
                <Text className="text-white text-xs">✓ Vérifié</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats rapides */}
        <View className="mx-4 -mt-5 bg-white rounded-2xl shadow-md shadow-gray-200 p-4 mb-4 flex-row gap-3">
          <View className="flex-1 items-center">
            <Text className="text-xl font-bold text-gray-800">{totalEcg}</Text>
            <Text className="text-[11px] text-gray-500 mt-0.5 text-center">ECG envoyés</Text>
          </View>
          <View className="w-px bg-gray-100" />
          <View className="flex-1 items-center">
            <Text className="text-xl font-bold text-amber-600">{pendingEcg}</Text>
            <Text className="text-[11px] text-gray-500 mt-0.5 text-center">En attente</Text>
          </View>
          <View className="w-px bg-gray-100" />
          <View className="flex-1 items-center">
            <Text className={`text-xl font-bold ${unreadReports > 0 ? 'text-indigo-600' : 'text-gray-800'}`}>
              {unreadReports}
            </Text>
            <Text className="text-[11px] text-gray-500 mt-0.5 text-center">Non lus</Text>
          </View>
        </View>

        {/* Quota */}
        {(economy || economyLoading) && (
          <View className="mx-4 bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm shadow-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-3">Quota d'utilisation</Text>
            {economyLoading
              ? <ActivityIndicator color="#4f46e5" />
              : economy && (
                <>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-xs text-gray-500">
                      {economy.quota_used} / {economy.quota_total} ECG utilisés
                    </Text>
                    <Text className="text-xs font-semibold text-gray-700">{quotaPercent}%</Text>
                  </View>
                  <View className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <View
                      className={`h-2 rounded-full ${
                        (quotaPercent ?? 0) >= 90 ? 'bg-red-500' :
                        (quotaPercent ?? 0) >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(quotaPercent ?? 0, 100)}%` }}
                    />
                  </View>
                  {economy.subscription_plan && (
                    <Text className="text-xs text-gray-400 mt-2">
                      Plan : {economy.subscription_plan}
                      {economy.subscription_status ? ` · ${economy.subscription_status}` : ''}
                    </Text>
                  )}
                </>
              )
            }
          </View>
        )}

        {/* Paramètres compte */}
        <View className="mx-4 bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-100 mb-4 overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-4 pb-1">
            Compte
          </Text>
          <SettingRow icon="👤" label="Informations personnelles" onPress={() => {}} />
          <Divider />
          <SettingRow icon="🔒" label="Changer le mot de passe" onPress={() => {}} />
          {isBiometricAvailable && (
            <>
              <Divider />
              <SettingRow
                icon={Platform.OS === 'ios' ? '🔒' : '👆'}
                label={`${Platform.OS === 'ios' ? 'Face ID' : 'Empreinte digitale'}`}
                value={isBiometricEnrolled ? 'Activé' : 'Désactivé'}
              />
            </>
          )}
        </View>

        {/* Notifications */}
        <View className="mx-4 bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-100 mb-4 overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-4 pb-1">
            Notifications
          </Text>
          <SettingRow icon="🔔" label="Notifications push" value="Activées" onPress={() => {}} />
          <Divider />
          <SettingRow icon="⚡" label="Alertes urgentes" value="Toujours" />
        </View>

        {/* RGPD */}
        <View className="mx-4 bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-100 mb-4 overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-4 pb-1">
            Données & Confidentialité (RGPD)
          </Text>
          <SettingRow icon="📤" label="Exporter mes données" onPress={() => {
            Alert.alert('Export en cours', 'Vos données seront envoyées par email sous 72h.');
          }} />
          <Divider />
          <SettingRow icon="🗑️" label="Supprimer mes données" onPress={handleRgpdDelete} dangerous />
        </View>

        {/* Version */}
        <View className="mx-4 bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-100 mb-4 overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-4 pb-1">
            À propos
          </Text>
          <SettingRow icon="ℹ️" label="Version" value="1.0.0" />
          <Divider />
          <SettingRow icon="📋" label="Conditions d'utilisation" onPress={() => {}} />
          <Divider />
          <SettingRow icon="🛡️" label="Politique de confidentialité" onPress={() => {}} />
        </View>

        {/* Déconnexion */}
        <View className="mx-4 mb-4">
          <TouchableOpacity
            className="bg-red-50 border border-red-200 rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.8}
          >
            {loggingOut
              ? <ActivityIndicator color="#ef4444" size="small" />
              : (
                <>
                  <Text className="text-lg">🚪</Text>
                  <Text className="text-red-600 font-semibold text-sm">Se déconnecter</Text>
                </>
              )
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
