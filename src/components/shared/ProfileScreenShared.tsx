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
import { api } from '@/lib/apiClient';
import { useTheme, type ThemePreference } from '@/providers/ThemeProvider';
import { useTranslation, type Locale } from '@/i18n';

const ROLE_LABEL: Record<string, string> = {
  medecin: 'Médecin prescripteur',
  cardiologue: 'Cardiologue',
  secretaire: 'Secrétaire',
  admin: 'Administrateur',
};

function formatDoctorName(name: string): string {
  const stripped = name.replace(/^(\s*(Dr\.?\s+|Pr\.?\s+))+/i, '').trim();
  const hadTitle = /^(Dr\.?\s+|Pr\.?\s+)/i.test(name);
  return hadTitle ? `Dr ${stripped}` : stripped;
}

function getNameInitials(name: string): string {
  const stripped = name.replace(/^(\s*(Dr\.?\s+|Pr\.?\s+))+/i, '').trim();
  const initials = stripped
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
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

const LOCALE_OPTIONS: { key: Locale; label: string; flag: string }[] = [
  { key: 'fr', label: 'Français', flag: '🇫🇷' },
  { key: 'en', label: 'English', flag: '🇬🇧' },
];

export default function ProfileScreenShared() {
  const { user, logout, isBiometricAvailable, isBiometricEnrolled } = useAuth();
  const { colors: joyful, preference, setPreference } = useTheme();
  const { locale, setLocale } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loggingOut, setLoggingOut] = useState(false);
  const [kpiLoading] = useState(false);

  const [ratioStatus, setRatioStatus] = useState<'OK' | 'ALERT' | 'SUSPENDED' | null>(null);

  useEffect(() => {
    if (user?.role !== 'cardiologue') return;
    api.get<{ latest?: { ratio_status?: 'OK' | 'ALERT' | 'SUSPENDED' } }>(
      `/economy/cardiologists/${user.id}/ratios`,
    )
      .then(d => { if (d.latest?.ratio_status) setRatioStatus(d.latest.ratio_status); })
      .catch(() => null);
  }, [user?.id, user?.role]);

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
      'Demander la suppression de toutes vos données personnelles ? Cette action est irréversible.',
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

  const roleLabel = ROLE_LABEL[user?.role ?? 'medecin'] ?? user?.role ?? '';

  return (
    <View className="flex-1 dark:bg-zinc-950" style={{ paddingTop: insets.top, backgroundColor: joyful.screenBg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
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
              <Text className="text-white text-xs">{roleLabel}</Text>
            </View>
            {ratioStatus && ratioStatus !== 'OK' && (
              <View className={`rounded-full px-3 py-0.5 ${ratioStatus === 'SUSPENDED' ? 'bg-red-500/80' : 'bg-amber-500/80'}`}>
                <Text className="text-white text-xs">
                  {ratioStatus === 'SUSPENDED' ? '🚫 Ratio suspendu' : '⚠️ Ratio alerte'}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {kpiLoading && (
          <View className="mx-4 mt-2">
            <ActivityIndicator color={joyful.primary} />
          </View>
        )}

        {/* Apparence */}
        <View className="mx-4 mt-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm shadow-gray-100 dark:shadow-none mb-4 overflow-hidden">
          <Text className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider px-4 pt-4 pb-2">
            Apparence
          </Text>
          <View className="flex-row px-3 pb-3 gap-2">
            {THEME_OPTIONS.map(opt => {
              const active = preference === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  className={`flex-1 py-2.5 rounded-xl border items-center ${
                    active ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
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

          <Text className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider px-4 pt-3 pb-2">
            Langue
          </Text>
          <View className="flex-row px-3 pb-3 gap-2">
            {LOCALE_OPTIONS.map(opt => {
              const active = locale === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  className={`flex-1 py-2.5 rounded-xl border items-center flex-row justify-center gap-1.5 ${
                    active ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'
                  }`}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setLocale(opt.key);
                  }}
                  activeOpacity={0.85}
                  accessibilityLabel={`Langue ${opt.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text className="text-sm">{opt.flag}</Text>
                  <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-700 dark:text-zinc-300'}`}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Compte */}
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
                label={Platform.OS === 'ios' ? 'Face ID' : 'Empreinte digitale'}
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

        {/* À propos */}
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
