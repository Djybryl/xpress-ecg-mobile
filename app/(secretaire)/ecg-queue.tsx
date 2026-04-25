import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEcgValidationQueue } from '@/hooks/useEcgValidationQueue';
import { useActiveCardiologues } from '@/hooks/useActiveCardiologues';
import { api } from '@/lib/apiClient';
import type { EcgRecordItem } from '@/hooks/useEcgList';
import { useAuth } from '@/providers/AuthProvider';

const FILTER_CHIPS: { key: string; label: string }[] = [
  { key: 'all',       label: 'Tous' },
  { key: 'pending',   label: 'En attente' },
  { key: 'validated', label: 'Validés' },
  { key: 'assigned',  label: 'Assignés' },
  { key: 'completed', label: 'Terminés' },
];

const STATUS_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  pending:   { label: 'En attente',  bgColor: '#fef3c7', textColor: '#d97706' },
  validated: { label: 'Validé',      bgColor: '#d1fae5', textColor: '#065f46' },
  assigned:  { label: 'Assigné',     bgColor: '#dbeafe', textColor: '#1e40af' },
  analyzing: { label: 'En analyse',  bgColor: '#ede9fe', textColor: '#5b21b6' },
  completed: { label: 'Terminé',     bgColor: '#f0fdf4', textColor: '#166534' },
};

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

function StatusBadge({ status }: { status: EcgRecordItem['status'] }) {
  const c = STATUS_CONFIG[status] ?? { label: status, bgColor: '#f3f4f6', textColor: '#374151' };
  return (
    <View style={{ backgroundColor: c.bgColor, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
      <Text style={{ fontSize: 10, fontWeight: '600', color: c.textColor }}>{c.label}</Text>
    </View>
  );
}

export default function SecretaireEcgQueue() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [assigningRecord, setAssigningRecord] = useState<EcgRecordItem | null>(null);
  const [assigning, setAssigning] = useState(false);

  const { users: cardiologues, loading: cardioLoading } = useActiveCardiologues();

  const statusParam = filter === 'all' ? undefined : filter;
  const { records, total, loading, refetch } = useEcgValidationQueue(
    statusParam,
    200,
    user?.hospitalId ?? null,
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(r =>
      (r.patient_name ?? '').toLowerCase().includes(q) ||
      (r.reference ?? '').toLowerCase().includes(q) ||
      (r.medical_center ?? '').toLowerCase().includes(q),
    );
  }, [records, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAssign = useCallback(async (cardiologistId: string) => {
    if (!assigningRecord) return;
    setAssigning(true);
    try {
      await api.post(`/ecg-records/${assigningRecord.id}/assign`, { cardiologistId });
      setAssignModal(false);
      setAssigningRecord(null);
      await refetch();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'assigner');
    } finally {
      setAssigning(false);
    }
  }, [assigningRecord, refetch]);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-950" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 pt-3 pb-3 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-xl font-bold text-gray-900 dark:text-zinc-100">File ECG</Text>
            <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              {loading ? '…' : `${total} dossier${total > 1 ? 's' : ''}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            style={{ backgroundColor: joyful.primaryMuted, padding: 8, borderRadius: 10 }}
          >
            <Ionicons name="refresh" size={16} color={joyful.primary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher patient, référence…"
          placeholderTextColor="#9ca3af"
          className="bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-zinc-100 mb-3"
        />

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {FILTER_CHIPS.map(chip => (
            <TouchableOpacity
              key={chip.key}
              onPress={() => setFilter(chip.key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: filter === chip.key ? joyful.primary : '#f3f4f6',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: filter === chip.key ? '#fff' : '#6b7280' }}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
            <Ionicons name="document-text-outline" size={48} color="#9ca3af" />
            <Text className="mt-3 text-gray-400 dark:text-zinc-500 text-sm">Aucun dossier</Text>
          </View>
        )}
        {filtered.map(record => (
          <View
            key={record.id}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-2 shadow-sm"
          >
            {/* Row 1: Patient + urgency */}
            <View className="flex-row justify-between items-start mb-2">
              <View style={{ flex: 1 }}>
                <Text className="text-[14px] font-bold text-gray-900 dark:text-zinc-100" numberOfLines={1}>
                  {record.patient_name ?? 'Patient inconnu'}
                  {record.gender != null ? ` (${record.gender})` : ''}
                  {record.patient_age != null ? ` · ${record.patient_age} ans` : ''}
                </Text>
                <Text className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">
                  {record.reference ?? record.id.slice(0, 8)} · {record.medical_center ?? '—'}
                </Text>
              </View>
              {record.urgency === 'urgent' && (
                <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#dc2626' }}>URGENT</Text>
                </View>
              )}
            </View>

            {/* Row 2: status + date + action */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <StatusBadge status={record.status} />
                <Text className="text-[10px] text-gray-400 dark:text-zinc-500">
                  {timeAgo(record.created_at)}
                </Text>
              </View>

              {(record.status === 'pending' || record.status === 'validated') && record.assigned_to == null && (
                <TouchableOpacity
                  onPress={() => { setAssigningRecord(record); setAssignModal(true); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    borderWidth: 1, borderColor: '#7c3aed',
                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                  }}
                >
                  <Ionicons name="person-add-outline" size={13} color="#7c3aed" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#7c3aed' }}>Assigner</Text>
                </TouchableOpacity>
              )}
            </View>

            {record.clinical_context != null && record.clinical_context.trim() !== '' && (
              <Text className="text-[11px] text-gray-500 dark:text-zinc-400 mt-2 italic" numberOfLines={2}>
                {record.clinical_context}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Modal d'assignation */}
      <Modal
        visible={assignModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setAssignModal(false); setAssigningRecord(null); }}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          onPress={() => { setAssignModal(false); setAssigningRecord(null); }}
        >
          <Pressable onPress={() => { /* intercepte le tap pour ne pas fermer */ }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 16 }}>
              {/* En-tête */}
              <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>Assigner à un cardiologue</Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>L'ECG sera directement visible dans sa file</Text>
              </View>

              {/* Liste des cardiologues */}
              <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingVertical: 8 }}>
                {cardioLoading && (
                  <ActivityIndicator color="#7c3aed" style={{ marginVertical: 24 }} />
                )}
                {!cardioLoading && cardiologues.length === 0 && (
                  <Text style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, paddingVertical: 24 }}>
                    Aucun cardiologue disponible
                  </Text>
                )}
                {cardiologues.map(cardio => {
                  const initials = (cardio.full_name ?? '??').trim().slice(0, 2).toUpperCase();
                  return (
                    <TouchableOpacity
                      key={cardio.id}
                      disabled={assigning}
                      onPress={() => void handleAssign(cardio.id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        paddingHorizontal: 20, paddingVertical: 13,
                        opacity: assigning ? 0.5 : 1,
                      }}
                    >
                      {/* Cercle initiales */}
                      <View style={{
                        width: 40, height: 40, borderRadius: 20,
                        backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#6d28d9' }}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                          Dr {cardio.full_name}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#10b981', marginTop: 1 }}>Disponible</Text>
                      </View>
                      {assigning && (
                        <ActivityIndicator size="small" color="#7c3aed" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Bouton Annuler */}
              <TouchableOpacity
                onPress={() => { setAssignModal(false); setAssigningRecord(null); }}
                style={{
                  marginHorizontal: 20, marginTop: 8,
                  paddingVertical: 13, borderRadius: 14,
                  backgroundColor: '#f3f4f6', alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
