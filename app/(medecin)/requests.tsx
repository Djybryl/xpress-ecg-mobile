import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
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

function StatusBadge({ status }: { status: EcgRecordItem['status'] }) {
  const config = {
    pending:   { label: 'En attente',  bg: 'bg-amber-100',  text: 'text-amber-700' },
    assigned:  { label: 'Assigné',     bg: 'bg-sky-100',    text: 'text-sky-700' },
    analyzing: { label: 'En analyse',  bg: 'bg-blue-100',   text: 'text-blue-700' },
    completed: { label: 'Terminé',     bg: 'bg-green-100',  text: 'text-green-700' },
    validated: { label: 'Validé',      bg: 'bg-green-100',  text: 'text-green-700' },
  }[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-600' };

  return (
    <View className={`${config.bg} px-2 py-0.5 rounded-full`}>
      <Text className={`${config.text} text-[10px] font-medium`}>{config.label}</Text>
    </View>
  );
}

function EcgCard({ item }: { item: EcgRecordItem }) {
  const initials = (item.patient_name ?? 'P').slice(0, 2).toUpperCase();
  const isUrgent = item.urgency === 'urgent';

  return (
    <TouchableOpacity
      className={`bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 border ${isUrgent ? 'border-red-200 dark:border-red-900' : 'border-gray-100 dark:border-zinc-800'} shadow-sm shadow-gray-100 dark:shadow-none`}
      activeOpacity={0.8}
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
            <StatusBadge status={item.status} />
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

export default function RequestsScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

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
    if (statusFilter === 'analyzing' && r.status !== 'analyzing' && r.status !== 'assigned') return false;
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
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
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
              : filtered.map(item => <EcgCard key={item.id} item={item} />)
            }
          </ScrollView>
        )
      }
    </View>
  );
}
