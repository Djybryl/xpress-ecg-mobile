import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useEcgList } from '@/hooks/useEcgList';
import { useReportList } from '@/hooks/useReportList';
import { api } from '@/lib/apiClient';
import { useTheme, type ThemePreference } from '@/providers/ThemeProvider';

interface EconomyGate {
  allowed: boolean;
  remaining?: number;
  mode: 'subscription' | 'user_quota' | 'premium_unmetered' | 'no_limit';
  reason?: string;
  code?: string;
}

interface EconomyQuota {
  ecg_used: number;
  ecg_limit: number;
}

interface EconomySubscription {
  plan: string;
  status: string;
  monthly_ecg_quota: number;
  ecg_used_this_month: number;
}

interface EconomyData {
  monthYear: string;
  accessLevel: 'GRATUIT' | 'PREMIUM';
  gate: EconomyGate;
  quota: EconomyQuota | null;
  subscription: EconomySubscription | null;
}

/**
 * Supprime les préfixes de titre médicaux en doublon (Dr, Dr., Pr, Pr.)
 * et normalise à une seule occurrence si présente.
 * "Dr Dr. Jean Martin" → "Dr Jean Martin"
 */
function formatDoctorName(name: string): string {
  const stripped = name.replace(/^(\s*(Dr\.?\s+|Pr\.?\s+))+/i, '').trim();
  const hadTitle = /^(Dr\.?\s+|Pr\.?\s+)/i.test(name);
  return hadTitle ? `Dr ${stripped}` : stripped;
}

/**
 * Retourne les 2 initiales des noms propres en ignorant le préfixe "Dr"/"Pr".
 * "Dr. Jean Martin" → "JM"  |  "Dr Dr Jean Martin" → "JM"
 */
function getNameInitials(name: string): string {
  const stripped = name.replace(/^(\s*(Dr\.?\s+|Pr\.?\s+))+/i, '').trim();
  const initials = stripped
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return initials || name.slice(0, 2).toUpperCase();
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
      <Text className={`flex-1 text-sm ${dangerous ? 'text-red-600' : 'text-gray-800 dark:text-zinc-200'} font-medium`}>
        {label}
      </Text>
      {value && <Text className="text-xs text-gray-400 dark:text-zinc-500 mr-2">{value}</Text>}
      {onPress && <Text className="text-gray-300 dark:text-zinc-600 text-base">›</Text>}
    </TouchableOpacity>
  );
}

function Divider() {
  return <View className="h-px bg-gray-100 dark:bg-zinc-800 mx-4" />;
}

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'light', label: 'Clair' },
  { key: 'dark', label: 'Sombre' },
  { key: 'system', label: 'Système' },
];

export default function ProfileScreen() {
  const { user, logout, isBiometricAvailable, isBiometricEnrolled } = useAuth();
  const { colors: joyful, preference, setPreference } = useTheme();
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

  useEffect(() => {
    void loadEconomy();
  }, [loadEconomy]);

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

  const ecgUsed      = economy?.quota?.ecg_used ?? economy?.subscription?.ecg_used_this_month ?? 0;
  const ecgLimit     = economy?.quota?.ecg_limit ?? economy?.subscription?.monthly_ecg_quota ?? 0;
  const ecgRemaining = economy?.gate?.remaining ?? Math.max(0, ecgLimit - ecgUsed);
  const quotaPercent = ecgLimit > 0 ? Math.round((ecgUsed / ecgLimit) * 100) : null;

  return (
    <View className="flex-1 dark:bg-zinc-950" style={{ paddingTop: insets.top, backgroundColor: joyful.screenBg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header profil */}
        <LinearGradient
          colors={[joyful.primaryDark, joyful.primary, joyful.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }}
        >
          <View className="w-16 h-16 rounded-2xl bg-white/20 items-center justify-center mb-3">
            <Text className="text-white text-2xl font-bold">
              {user ? getNameInitials(user.name) : 'ME'}
            </Text>
          </View>
          <Text className="text-white text-xl font-bold">{user ? formatDoctorName(user.name) : '—'}</Text>
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
        </LinearGradient>

        {/* Stats rapides */}
        <View className="mx-4 -mt-5 bg-white dark:bg-zinc-900 rounded-2xl shadow-md shadow-gray-200 dark:shadow-none border border-gray-100 dark:border-zinc-800 p-4 mb-4 flex-row gap-3">
          <View className="flex-1 items-center">
            <Text className="text-xl font-bold text-gray-800 dark:text-zinc-100">{totalEcg}</Text>
            <Text className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 text-center">ECG envoyés</Text>
          </View>
          <View className="w-px bg-gray-100 dark:bg-zinc-800" />
          <View className="flex-1 items-center">
            <Text className="text-xl font-bold text-amber-600">{pendingEcg}</Text>
            <Text className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 text-center">En attente</Text>
          </View>
          <View className="w-px bg-gray-100 dark:bg-zinc-800" />
          <View className="flex-1 items-center">
            <Text className={`text-xl font-bold ${unreadReports > 0 ? 'text-indigo-600 dark:text-violet-400' : 'text-gray-800 dark:text-zinc-100'}`}>
              {unreadReports}
            </Text>
            <Text className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 text-center">Non lus</Text>
          </View>
        </View>

        {/* Quota */}
        {(economy || economyLoading) && (
          <View className="mx-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4 mb-4 shadow-sm shadow-gray-100 dark:shadow-none">
            <Text className="text-sm font-semibold text-gray-700 dark:text-zinc-200 mb-3">
              {economy?.subscription ? 'Quota mensuel' : 'Quota gratuit mensuel'}
            </Text>
            {economyLoading
              ? <ActivityIndicator color="#4f46e5" />
              : economy && (
                <>
                  {/* Nombre restant en évidence */}
                  <View className="flex-row items-center gap-3 mb-3">
                    <View className={`rounded-xl px-3 py-2 ${
                      ecgRemaining <= 0 ? 'bg-red-100 dark:bg-red-950/50'
                      : ecgRemaining <= 3 ? 'bg-amber-100 dark:bg-amber-950/50'
                      : 'bg-emerald-100 dark:bg-emerald-950/50'
                    }`}>
                      <Text className={`text-2xl font-bold ${
                        ecgRemaining <= 0 ? 'text-red-600 dark:text-red-400'
                        : ecgRemaining <= 3 ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {ecgRemaining}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-gray-700 dark:text-zinc-200">
                        {ecgRemaining <= 0
                          ? 'Quota épuisé ce mois'
                          : `demande${ecgRemaining > 1 ? 's' : ''} restante${ecgRemaining > 1 ? 's' : ''} ce mois`}
                      </Text>
                      <Text className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                        {ecgUsed} utilisée{ecgUsed > 1 ? 's' : ''} sur {ecgLimit} · {economy.monthYear}
                      </Text>
                    </View>
                  </View>
                  {/* Barre de progression */}
                  <View className="bg-gray-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <View
                      className={`h-2 rounded-full ${
                        (quotaPercent ?? 0) >= 90 ? 'bg-red-500' :
                        (quotaPercent ?? 0) >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(quotaPercent ?? 0, 100)}%` }}
                    />
                  </View>
                  {economy.subscription && (
                    <Text className="text-xs text-gray-400 dark:text-zinc-500 mt-2">
                      Plan : {economy.subscription.plan}
                      {economy.subscription.status ? ` · ${economy.subscription.status}` : ''}
                    </Text>
                  )}
                </>
              )
            }
          </View>
        )}

        {/* Apparence */}
        <View className="mx-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm shadow-gray-100 dark:shadow-none mb-4 overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider px-4 pt-4 pb-2">
            Apparence
          </Text>
          <View className="flex-row px-3 pb-3 gap-2">
            {THEME_OPTIONS.map((opt) => {
              const active = preference === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  className={`flex-1 py-2.5 rounded-xl border items-center ${
                    active
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
                  }`}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPreference(opt.key);
                  }}
                  activeOpacity={0.85}
                >
                  <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-700 dark:text-zinc-300'}`}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Paramètres compte */}
        <View className="mx-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm shadow-gray-100 dark:shadow-none mb-4 overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider px-4 pt-4 pb-1">
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
        <View className="mx-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm shadow-gray-100 dark:shadow-none mb-4 overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider px-4 pt-4 pb-1">
            Notifications
          </Text>
          <SettingRow icon="🔔" label="Notifications push" value="Activées" onPress={() => {}} />
          <Divider />
          <SettingRow icon="⚡" label="Alertes urgentes" value="Toujours" />
        </View>

        {/* RGPD */}
        <View className="mx-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm shadow-gray-100 dark:shadow-none mb-4 overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider px-4 pt-4 pb-1">
            Données & Confidentialité (RGPD)
          </Text>
          <SettingRow icon="📤" label="Exporter mes données" onPress={() => {
            Alert.alert('Export en cours', 'Vos données seront envoyées par email sous 72h.');
          }} />
          <Divider />
          <SettingRow icon="🗑️" label="Supprimer mes données" onPress={handleRgpdDelete} dangerous />
        </View>

        {/* Version */}
        <View className="mx-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm shadow-gray-100 dark:shadow-none mb-4 overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider px-4 pt-4 pb-1">
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
