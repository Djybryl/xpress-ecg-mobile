import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePendingPrescribers, type PrescriberPendingItem } from '@/hooks/usePendingPrescribers';
import { api } from '@/lib/apiClient';

const GATE_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  pending_full_verification:      { label: 'En attente',        bgColor: '#fef3c7', textColor: '#d97706' },
  provisional_expired:            { label: 'Provisoire expiré', bgColor: '#fee2e2', textColor: '#dc2626' },
  provisional_blocked_no_min_doc: { label: 'Docs insuffisants', bgColor: '#fce7f3', textColor: '#be185d' },
  verified:                       { label: 'Vérifié',           bgColor: '#d1fae5', textColor: '#065f46' },
  rejected:                       { label: 'Rejeté',            bgColor: '#fee2e2', textColor: '#991b1b' },
};

function GateBadge({ status }: { status: string | null }) {
  const c = GATE_CONFIG[status ?? ''] ?? { label: status ?? '—', bgColor: '#f3f4f6', textColor: '#374151' };
  return (
    <View style={{ backgroundColor: c.bgColor, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ fontSize: 10, fontWeight: '600', color: c.textColor }}>{c.label}</Text>
    </View>
  );
}

function getInitials(name: string): string {
  const stripped = name.replace(/^(\s*(Dr\.?\s+|Pr\.?\s+))+/i, '').trim();
  const parts = stripped.split(' ').filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(dateStr));
}

export default function SecretairePrescribers() {
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { items, loading, refetch } = usePendingPrescribers(true);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      p => p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
    );
  }, [items, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const doValidate = useCallback(async (prescriber: PrescriberPendingItem) => {
    setActionLoading(prescriber.id);
    try {
      await api.post(`/admin-prescribers/${prescriber.id}/validate`, {});
      await refetch();
      Alert.alert('Succès', `Dossier de ${prescriber.full_name} validé.`);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de valider');
    } finally {
      setActionLoading(null);
    }
  }, [refetch]);

  const handleValidate = useCallback((prescriber: PrescriberPendingItem) => {
    Alert.alert(
      'Valider ce dossier',
      `Valider le dossier de ${prescriber.full_name} ?\n\nCette action donnera un accès complet au prescripteur.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Valider', onPress: () => { void doValidate(prescriber); } },
      ],
    );
  }, [doValidate]);

  const doReject = useCallback(async (prescriber: PrescriberPendingItem) => {
    setActionLoading(prescriber.id);
    try {
      await api.post(`/admin-prescribers/${prescriber.id}/reject`, {});
      await refetch();
      Alert.alert('Dossier rejeté', `Le prescripteur ${prescriber.full_name} a été notifié.`);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de rejeter');
    } finally {
      setActionLoading(null);
    }
  }, [refetch]);

  const handleReject = useCallback((prescriber: PrescriberPendingItem) => {
    Alert.alert(
      'Rejeter ce dossier',
      `Rejeter le dossier de ${prescriber.full_name} ? Le prescripteur sera notifié.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Rejeter', style: 'destructive', onPress: () => { void doReject(prescriber); } },
      ],
    );
  }, [doReject]);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-950" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 pt-3 pb-3 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-xl font-bold text-gray-900 dark:text-zinc-100">Prescripteurs</Text>
            <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              {loading ? '…' : `${items.length} dossier${items.length > 1 ? 's' : ''} en attente`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            style={{ backgroundColor: joyful.primaryMuted, padding: 8, borderRadius: 10 }}
          >
            <Ionicons name="refresh" size={16} color={joyful.primary} />
          </TouchableOpacity>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un prescripteur…"
          placeholderTextColor="#9ca3af"
          className="bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-zinc-100"
        />
      </View>

      {/* List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={joyful.primary} />}
      >
        {loading && !refreshing && (
          <ActivityIndicator color={joyful.primary} style={{ marginTop: 40 }} />
        )}
        {!loading && filtered.length === 0 && (
          <View className="items-center pt-16">
            <Ionicons name="people-outline" size={48} color="#9ca3af" />
            <Text className="mt-3 text-gray-400 dark:text-zinc-500 text-sm">
              Aucun dossier en attente
            </Text>
          </View>
        )}

        {filtered.map(prescriber => (
          <View
            key={prescriber.id}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 shadow-sm"
          >
            {/* Row 1: avatar + identity */}
            <View className="flex-row items-center mb-3">
              <View
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: joyful.primaryMuted, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: joyful.primary }}>
                  {getInitials(prescriber.full_name)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-[14px] font-bold text-gray-900 dark:text-zinc-100" numberOfLines={1}>
                  {prescriber.full_name}
                </Text>
                <Text className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5" numberOfLines={1}>
                  {prescriber.email}
                </Text>
              </View>
              <GateBadge status={prescriber.prescriber_gate_status} />
            </View>

            {/* Row 2: metadata */}
            <View className="flex-row gap-4 mb-3 px-1">
              <View className="items-center">
                <Ionicons name="document-text-outline" size={14} color="#9ca3af" />
                <Text className="text-[12px] font-bold text-gray-800 dark:text-zinc-200 mt-1">
                  {prescriber.documentsCount}
                </Text>
                <Text className="text-[9px] text-gray-400 dark:text-zinc-500">docs</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-[10px] text-gray-400 dark:text-zinc-500">Inscription</Text>
                <Text className="text-[11px] font-semibold text-gray-800 dark:text-zinc-200 mt-0.5">
                  {formatDate(prescriber.prescriber_first_login_at)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-[10px] text-gray-400 dark:text-zinc-500">Statut dossier</Text>
                <Text className="text-[11px] font-semibold text-gray-800 dark:text-zinc-200 mt-0.5">
                  {prescriber.dossierStatus ?? '—'}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => handleValidate(prescriber)}
                disabled={actionLoading === prescriber.id}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#d1fae5', paddingVertical: 9, borderRadius: 12 }}
              >
                {actionLoading === prescriber.id ? (
                  <ActivityIndicator size="small" color="#065f46" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={14} color="#065f46" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#065f46' }}>Valider</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleReject(prescriber)}
                disabled={actionLoading === prescriber.id}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fee2e2', paddingVertical: 9, borderRadius: 12 }}
              >
                <Ionicons name="close-circle" size={14} color="#dc2626" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#dc2626' }}>Rejeter</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
