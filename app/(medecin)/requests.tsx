import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useEcgList, type EcgRecordItem } from '@/hooks/useEcgList';

const STATUS_FILTERS = [
  { key: '', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'analyzing', label: 'En analyse' },
  { key: 'completed', label: 'Terminés' },
];

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

function StatusBadge({ item }: { item: EcgRecordItem }) {
  const { status, assigned_to } = item;
  if (status === 'analyzing') {
    return (
      <View className="bg-blue-100 px-2 py-0.5 rounded-full" accessible={false} importantForAccessibility="no">
        <Text className="text-blue-700 text-[10px] font-medium">En analyse</Text>
      </View>
    );
  }
  if (status === 'completed') {
    return (
      <View className="bg-green-100 px-2 py-0.5 rounded-full" accessible={false} importantForAccessibility="no">
        <Text className="text-green-700 text-[10px] font-medium">Terminé</Text>
      </View>
    );
  }
  const reserved = !!assigned_to;
  const config = {
    pending:   { label: reserved ? 'En attente · réservé' : 'En attente', bg: 'bg-amber-100', text: 'text-amber-700' },
    assigned:  { label: reserved ? 'En attente · réservé' : 'En attente', bg: 'bg-amber-100', text: 'text-amber-700' },
    analyzing: { label: 'En analyse',  bg: 'bg-blue-100',   text: 'text-blue-700' },
    completed: { label: 'Terminé',     bg: 'bg-green-100',  text: 'text-green-700' },
    validated: { label: reserved ? 'En attente · réservé' : 'En attente', bg: 'bg-amber-100', text: 'text-amber-700' },
  }[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-600' };

  return (
    <View className={`${config.bg} px-2 py-0.5 rounded-full`} accessible={false} importantForAccessibility="no">
      <Text className={`${config.text} text-[10px] font-medium`}>{config.label}</Text>
    </View>
  );
}

function EcgCard({ item, onPress }: { item: EcgRecordItem; onPress: () => void }) {
  const initials = (item.patient_name ?? 'P').slice(0, 2).toUpperCase();
  const isUrgent = item.urgency === 'urgent';
  const isCompleted = item.status === 'completed';

  return (
    <TouchableOpacity
      className={`bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 border ${isUrgent ? 'border-red-200 dark:border-red-900' : 'border-gray-100 dark:border-zinc-800'} shadow-sm shadow-gray-100 dark:shadow-none`}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`ECG ${item.patient_name}${isUrgent ? ', urgent' : ''}, ${item.reference}, statut : ${item.status === 'completed' ? 'Rapport disponible' : item.status === 'analyzing' ? 'En analyse' : 'En attente'}`}
      accessibilityHint="Appuyez pour voir les détails de cette demande"
    >
      <View className="flex-row items-start">
        <View className={`w-10 h-10 rounded-full ${isUrgent ? 'bg-red-100' : 'bg-indigo-100'} items-center justify-center mr-3 mt-0.5`}>
          <Text className={`text-xs font-bold ${isUrgent ? 'text-red-600' : 'text-indigo-600'}`}>{initials}</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-sm font-semibold text-gray-900 dark:text-zinc-100 flex-1 mr-2" numberOfLines={1}>
              {item.patient_name}
              {isUrgent && ' ⚡'}
            </Text>
            <View className="flex-row items-center gap-1.5">
              {isCompleted && (
                <Ionicons name="document-text-outline" size={15} color="#16a34a" />
              )}
              <StatusBadge item={item} />
            </View>
          </View>
          <Text className="text-xs text-gray-500 dark:text-zinc-400 mb-1">
            {item.reference}
          </Text>
          {item.clinical_context && (
            <Text className="text-xs text-gray-500 dark:text-zinc-400 mb-1" numberOfLines={2}>
              {item.clinical_context}
            </Text>
          )}
          <Text className="text-xs text-gray-400 dark:text-zinc-500">
            {item.medical_center} · {timeAgo(item.created_at)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const STATUS_DETAIL: Record<string, string> = {
  pending:   'En attente de prise en charge',
  validated: 'En attente de prise en charge',
  assigned:  'Assigné à un cardiologue',
  analyzing: 'Interprétation en cours',
  completed: 'Rapport disponible',
};

export default function RequestsScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEcg, setSelectedEcg] = useState<EcgRecordItem | null>(null);

  const { records, loading, error, refetch } = useEcgList({
    referring_doctor_id: user?.id,
    limit: 200,
    enabled: !!user?.id,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const filtered = records.filter(r => {
    if (statusFilter === 'analyzing' && r.status !== 'analyzing') return false;
    if (statusFilter && statusFilter !== 'analyzing' && r.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.patient_name.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        (r.clinical_context ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <View className="flex-1 dark:bg-zinc-950" style={{ paddingTop: insets.top, backgroundColor: joyful.screenBg }}>
      {/* Header */}
      <View style={{
        backgroundColor: joyful.stepBarBg,
        paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12,
        borderBottomWidth: 2, borderBottomColor: joyful.tabBarBorder,
      }}>
        <Text className="text-xl font-bold mb-3 dark:text-violet-200" style={{ color: joyful.primaryDark }}>Mes demandes ECG</Text>

        {/* Barre de recherche */}
        <View className="flex-row items-center bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 h-10 mb-3 border border-transparent dark:border-zinc-700">
          <Text className="text-gray-400 dark:text-zinc-500 mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-sm text-gray-800 dark:text-zinc-100"
            placeholder="Rechercher un patient, une référence…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            accessibilityLabel="Rechercher un patient ou une référence ECG"
            accessibilityHint="Saisissez un nom ou une référence"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
              <Text className="text-gray-400 text-lg leading-none">×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filtres statut */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {STATUS_FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              className={`px-3 py-1.5 rounded-full border ${
                statusFilter === f.key
                  ? 'bg-indigo-600 border-indigo-600'
                  : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-600'
              }`}
              onPress={() => setStatusFilter(f.key)}
              accessibilityRole="button"
              accessibilityLabel={`Filtrer : ${f.label}`}
              accessibilityState={{ selected: statusFilter === f.key }}
            >
              <Text className={`text-xs font-medium ${
                statusFilter === f.key ? 'text-white' : 'text-gray-600 dark:text-zinc-300'
              }`}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Compteur */}
      <View className="px-4 py-2">
        <Text className="text-xs text-gray-500 dark:text-zinc-400">
          {loading ? '…' : `${filtered.length} demande${filtered.length !== 1 ? 's' : ''}`}
        </Text>
      </View>

      {/* Erreur API */}
      {error && !loading && (
        <View className="mx-4 my-2 p-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-900 flex-row items-start gap-2">
          <Text className="text-red-500 text-base">⚠️</Text>
          <View className="flex-1">
            <Text className="text-red-700 dark:text-red-400 text-xs font-semibold">Impossible de charger les demandes</Text>
            <Text className="text-red-600 dark:text-red-500 text-xs mt-0.5">{error}</Text>
            <TouchableOpacity
              className="mt-2 bg-red-100 dark:bg-red-900/40 rounded-lg px-3 py-1.5 self-start"
              onPress={onRefresh}
            >
              <Text className="text-red-700 dark:text-red-300 text-xs font-semibold">Réessayer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Liste */}
      {loading && !refreshing
        ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#4f46e5" size="large" />
          </View>
        )
        : (
          <ScrollView
            className="flex-1 px-4"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
            }
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 30 }}
          >
            {!error && filtered.length === 0
              ? (
                <View className="items-center mt-16 px-6">
                  <Text className="text-4xl mb-3">📋</Text>
                  <Text className="text-gray-600 dark:text-zinc-400 font-medium text-center">
                    {search ? 'Aucune demande ne correspond à votre recherche.' : 'Aucune demande pour le moment.'}
                  </Text>
                  {!search && (
                    <Text className="text-xs text-gray-400 dark:text-zinc-500 text-center mt-2">
                      ID compte : {user?.id ?? 'non défini'}
                    </Text>
                  )}
                </View>
              )
              : filtered.map(item => (
                  <EcgCard key={item.id} item={item} onPress={() => setSelectedEcg(item)} />
                ))
            }
          </ScrollView>
        )
      }

      {/* Modal de détail */}
      <Modal
        visible={selectedEcg !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEcg(null)}
        accessibilityViewIsModal={true}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          onPress={() => setSelectedEcg(null)}
        >
          <Pressable onPress={() => { /* absorbe le tap intérieur */ }}>
            {selectedEcg && (
              <View style={{
                backgroundColor: '#fff',
                borderTopLeftRadius: 24, borderTopRightRadius: 24,
                paddingBottom: insets.bottom + 16,
                maxHeight: '90%',
              }}>
                {/* Poignée */}
                <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb' }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
                  {/* En-tête */}
                  <View style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', flexShrink: 1 }}>
                        {selectedEcg.reference}
                      </Text>
                      {selectedEcg.urgency === 'urgent' && (
                        <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#dc2626' }}>⚡ URGENT</Text>
                        </View>
                      )}
                    </View>
                    <StatusBadge item={selectedEcg} />
                  </View>

                  {/* Section patient */}
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>Patient</Text>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
                      {selectedEcg.patient_name}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      {selectedEcg.gender != null && (
                        <Text style={{ fontSize: 13, color: '#6b7280' }}>
                          {selectedEcg.gender === 'M' ? 'Homme' : 'Femme'}
                        </Text>
                      )}
                      {selectedEcg.patient_age != null && selectedEcg.patient_age > 0 && (
                        <Text style={{ fontSize: 13, color: '#6b7280' }}>{selectedEcg.patient_age} ans</Text>
                      )}
                    </View>
                    {selectedEcg.patient_id != null && (
                      <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Réf. patient : {selectedEcg.patient_id}</Text>
                    )}
                  </View>

                  {/* Section clinique */}
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>Informations cliniques</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Ionicons name="time-outline" size={14} color="#9ca3af" />
                      <Text style={{ fontSize: 13, color: '#374151' }}>
                        {new Intl.DateTimeFormat('fr-FR', {
                          day: '2-digit', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        }).format(new Date(selectedEcg.created_at))}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: selectedEcg.clinical_context ? 8 : 0 }}>
                      <Ionicons name="business-outline" size={14} color="#9ca3af" />
                      <Text style={{ fontSize: 13, color: '#374151' }}>{selectedEcg.medical_center}</Text>
                    </View>
                    {!!selectedEcg.clinical_context && (
                      <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8, marginTop: 4 }}>
                        <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Contexte clinique</Text>
                        <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19 }}>{selectedEcg.clinical_context}</Text>
                      </View>
                    )}
                  </View>

                  {/* Section statut */}
                  <View style={{ backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>Statut</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons
                        name={selectedEcg.status === 'completed' ? 'checkmark-circle' : 'hourglass-outline'}
                        size={18}
                        color={selectedEcg.status === 'completed' ? '#16a34a' : '#f59e0b'}
                      />
                      <Text style={{ fontSize: 14, color: '#111827', fontWeight: '500' }}>
                        {STATUS_DETAIL[selectedEcg.status] ?? selectedEcg.status}
                      </Text>
                    </View>

                    {selectedEcg.status === 'completed' && (
                      <TouchableOpacity
                        onPress={() => { setSelectedEcg(null); router.push('/(medecin)/reports'); }}
                        style={{
                          marginTop: 12, flexDirection: 'row', alignItems: 'center',
                          justifyContent: 'center', gap: 8,
                          backgroundColor: '#16a34a', paddingVertical: 11, borderRadius: 12,
                        }}
                      >
                        <Ionicons name="document-text-outline" size={16} color="#fff" />
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Voir le rapport</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>

                {/* Bouton Fermer */}
                <TouchableOpacity
                  onPress={() => setSelectedEcg(null)}
                  style={{
                    marginHorizontal: 20, paddingVertical: 13, borderRadius: 14,
                    backgroundColor: '#f3f4f6', alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>Fermer</Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
