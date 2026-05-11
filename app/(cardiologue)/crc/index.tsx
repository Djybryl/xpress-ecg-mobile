import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useCrcAccount } from '@/hooks/useCrcAccount';
import { useCrcHub } from '@/hooks/useCrcHub';

export default function CrcHubScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const enabled = user?.role === 'cardiologue';
  const { solde, loading: wLoading, refetch: refetchWallet, fromCacheOnly: walletOffline } = useCrcAccount(!!enabled);
  const {
    queueCount,
    prescribersCount,
    stats,
    loading: hLoading,
    refetch,
    fromCacheOnly: hubOffline,
  } = useCrcHub(!!enabled);

  const loading = enabled && (wLoading || hLoading);
  const low = solde < 400;

  const openPdf = useCallback(() => {
    if (stats?.report_pdf_signed_url) {
      void Linking.openURL(stats.report_pdf_signed_url);
    }
  }, [stats?.report_pdf_signed_url]);

  if (!enabled) {
    return (
      <View className="flex-1 justify-center p-6 bg-white dark:bg-zinc-950">
        <Stack.Screen options={{ title: 'Réseau CRC' }} />
        <Text className="text-center text-gray-600">Réservé aux cardiologues.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <Stack.Screen options={{ title: 'Réseau CRC' }} />
      {(walletOffline || hubOffline) && (
        <View
          className="mx-3 mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/50"
          accessibilityRole="alert"
          accessibilityLabel="Hors ligne, données en cache"
        >
          <Text className="text-amber-900 dark:text-amber-100 text-xs">Hors ligne — données en cache.</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <LinearGradient
          colors={['#4C1D95', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 22, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}
        >
          <Text className="text-white/80 text-xs font-semibold uppercase">Solde CRC</Text>
          <Text
            className="text-white text-3xl font-extrabold mt-1"
            accessibilityRole="text"
            accessibilityLabel={`Solde réseau CRC ${solde} francs CFA`}
          >
            {solde.toLocaleString('fr-FR')} FCFA
          </Text>
          <TouchableOpacity
            className="mt-3 self-start bg-white/20 px-4 py-2 rounded-xl"
            onPress={() => router.push('/(cardiologue)/crc/recharge' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Recharger le portefeuille CRC"
          >
            <Text className="text-white font-bold text-sm">Recharger</Text>
          </TouchableOpacity>
        </LinearGradient>

        {low && (
          <View
            className="mx-4 mt-3 p-3 rounded-xl bg-amber-100 border border-amber-300 dark:bg-amber-950/40 dark:border-amber-800"
            accessibilityRole="alert"
          >
            <Text className="text-amber-900 dark:text-amber-100 text-sm font-semibold">
              Solde faible — rechargez pour traiter les ECG réseau (400 FCFA par acte).
            </Text>
          </View>
        )}

        <View className="px-4 mt-4 gap-3">
          <TouchableOpacity
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-100 dark:border-zinc-800"
            onPress={() => router.push('/(cardiologue)/crc/queue' as Href)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`File ECG réseau, ${queueCount} en attente`}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold text-gray-500 uppercase">File ECG réseau</Text>
                {loading ? (
                  <ActivityIndicator className="mt-2" color={joyful.primary} />
                ) : (
                  <Text className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-1">{queueCount}</Text>
                )}
              </View>
              <Text className="text-violet-600 dark:text-violet-400 font-semibold">Voir →</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-100 dark:border-zinc-800"
            onPress={() => router.push('/(cardiologue)/crc/prescripteurs' as Href)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Prescripteurs du réseau, ${prescribersCount}`}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold text-gray-500 uppercase">Prescripteurs</Text>
                <Text className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-1">{prescribersCount}</Text>
              </View>
              <Text className="text-violet-600 dark:text-violet-400 font-semibold">Gérer →</Text>
            </View>
          </TouchableOpacity>

          <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-100 dark:border-zinc-800">
            <Text className="text-xs font-bold text-gray-500 uppercase mb-2">Stats du mois</Text>
            {stats ? (
              <>
                <Text className="text-gray-800 dark:text-zinc-200" accessibilityLabel={`${stats.totalEcg} ECG réseau ce mois`}>
                  ECG : {stats.totalEcg}
                </Text>
                <Text className="text-gray-800 dark:text-zinc-200 mt-1" accessibilityLabel={`Frais plateforme ${stats.totalFrais} francs CFA`}>
                  Frais plateforme : {stats.totalFrais.toLocaleString('fr-FR')} FCFA
                </Text>
                <TouchableOpacity
                  className="mt-3 bg-violet-600 rounded-xl py-3 items-center"
                  onPress={openPdf}
                  accessibilityRole="button"
                  accessibilityLabel="Télécharger le rapport PDF des statistiques CRC"
                >
                  <Text className="text-white font-bold">Rapport PDF</Text>
                </TouchableOpacity>
              </>
            ) : loading ? (
              <ActivityIndicator color={joyful.primary} />
            ) : (
              <Text className="text-gray-500 text-sm">Statistiques indisponibles</Text>
            )}
          </View>

          <TouchableOpacity
            className="py-2"
            onPress={() => { void refetch(); void refetchWallet(); }}
            accessibilityRole="button"
            accessibilityLabel="Actualiser le hub CRC"
          >
            <Text className="text-center text-violet-600 font-semibold">Actualiser</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
