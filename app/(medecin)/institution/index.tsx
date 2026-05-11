import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '@/providers/AuthProvider';
import { useInstitutionHub, type CreditHistoryRow } from '@/hooks/useInstitutionHub';
import { api, getApiErrorMessage } from '@/lib/apiClient';

function periodUtcYm(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function statusStyle(status: string): { bg: string; text: string; label: string } {
  const s = status.toLowerCase();
  if (s === 'approved' || s === 'validated' || s === 'completed') {
    return { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-800 dark:text-emerald-200', label: status };
  }
  if (s === 'pending') {
    return { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-900 dark:text-amber-200', label: 'En attente' };
  }
  if (s === 'rejected') {
    return { bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-800 dark:text-red-200', label: 'Rejeté' };
  }
  return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-200', label: status };
}

export default function InstitutionHubScreen() {
  const { user } = useAuth();
  const enabled =
    user?.role === 'medecin' && user?.activeAccountType === 'institutional' && !!(user?.institutionId ?? user?.hospitalId);

  const { data, loading, error, refetch, fromCacheOnly, accessibilityLabelOffline } = useInstitutionHub(!!enabled);

  const typeLabel = data?.type === 'postpaid' ? 'Postpayé' : data?.type === 'prepaid' ? 'Prépayé' : data?.type ?? '—';

  const onPdf = useCallback(async () => {
    const period = periodUtcYm();
    try {
      const res = await api.get<{ signedUrl: string }>(`/reports/financial/institution/${period}`);
      if (res.signedUrl) {
        await Linking.openURL(res.signedUrl);
      }
    } catch (e) {
      Alert.alert('Rapport PDF', getApiErrorMessage(e));
    }
  }, []);

  const history = useMemo(() => data?.history ?? [], [data?.history]);

  const instName = data?.institution?.name ?? user?.institutionName ?? 'Institution';

  if (!enabled) {
    return (
      <View className="flex-1 bg-white dark:bg-zinc-900 p-5 justify-center">
        <Stack.Screen options={{ title: 'Mon institution' }} />
        <Text className="text-center text-slate-600 dark:text-slate-400">
          Passez en compte institutionnel depuis l&apos;accueil pour consulter cette page.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <Stack.Screen options={{ title: 'Mon institution' }} />
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading && history.length === 0} onRefresh={refetch} />}
        ListHeaderComponent={
          <View className="p-4 gap-3">
            {fromCacheOnly ? (
              <View
                className="p-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/50 dark:border-amber-800"
                accessibilityRole="alert"
                accessibilityLabel={accessibilityLabelOffline}
              >
                <Text className="text-amber-900 dark:text-amber-100 text-xs font-medium">
                  Hors ligne — données affichées depuis le cache.
                </Text>
              </View>
            ) : null}

            <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800">
              <Text accessibilityRole="header" className="text-xl font-bold text-slate-900 dark:text-zinc-100">
                {instName}
              </Text>
              <Text className="text-sm text-slate-500 dark:text-slate-400 mt-1">Type : {typeLabel}</Text>
              <View className="self-start mt-2 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                <Text className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  Compte institutionnel actif
                </Text>
              </View>
            </View>

            <View className="bg-emerald-700 rounded-2xl p-4">
              <Text className="text-emerald-100 text-sm font-medium">Solde ECG</Text>
              {loading && data == null ? (
                <ActivityIndicator color="#fff" className="mt-2" />
              ) : (
                <>
                  <Text className="text-white text-3xl font-extrabold mt-1">{data?.solde_ecg ?? '—'}</Text>
                  {(data?.solde_ecg ?? 1) === 0 ? (
                    <Text className="text-amber-200 font-semibold mt-2">Solde épuisé — demandez des crédits.</Text>
                  ) : null}
                </>
              )}
            </View>

            {data?.type === 'postpaid' ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Demander des crédits"
                className="bg-indigo-600 rounded-xl py-3.5 items-center"
                onPress={() => router.push('./credit-request' as Href)}
              >
                <Text className="text-white font-semibold">Demander des crédits</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Membres de l'institution"
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl py-3.5 items-center"
              onPress={() => router.push('./members' as Href)}
            >
              <Text className="text-indigo-700 dark:text-indigo-300 font-semibold">Membres</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Télécharger le rapport mensuel PDF"
              accessibilityState={{ disabled: loading }}
              disabled={loading}
              className="bg-slate-800 dark:bg-slate-200 rounded-xl py-3.5 items-center"
              onPress={onPdf}
            >
              <Text className="text-white dark:text-slate-900 font-semibold">Rapport mensuel PDF</Text>
            </TouchableOpacity>

            {error ? (
              <Text accessibilityRole="alert" className="text-red-600 text-sm">
                {error}
              </Text>
            ) : null}

            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">Historique des demandes</Text>
          </View>
        }
        renderItem={({ item }: { item: CreditHistoryRow }) => {
          const st = statusStyle(item.status);
          return (
            <View className="mx-4 mb-2 bg-white dark:bg-zinc-900 rounded-xl p-3 border border-slate-100 dark:border-zinc-800 flex-row flex-wrap gap-2">
              <View className={`px-2 py-0.5 rounded-full ${st.bg}`}>
                <Text className={`text-[11px] font-bold ${st.text}`}>{st.label}</Text>
              </View>
              <View className="flex-1 min-w-[140px]">
                <Text className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                  {item.nb_paquets} paquet{item.nb_paquets > 1 ? 's' : ''} ·{' '}
                  {item.montant_total.toLocaleString('fr-FR')} FCFA
                </Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400">{formatShortDate(item.created_at)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <Text className="text-center text-slate-500 text-sm px-4">Aucune demande enregistrée.</Text>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}
