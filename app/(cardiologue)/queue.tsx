import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { router, type Href } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useCardiologistQueue } from '@/hooks/useCardiologistQueue';
import { ECGTraceView } from '@/components/ecg/ECGTraceView';
import type { EcgRecordItem } from '@/hooks/useEcgList';

const FILTER_CHIPS: { key: string; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'pool', label: 'À prendre' },
  { key: 'mine', label: 'Mes dossiers' },
  { key: 'busy', label: 'Collègues' },
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
    validated: { label: 'Validé',      bg: 'bg-emerald-100', text: 'text-emerald-700' },
  }[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-600' };

  return (
    <View className={`${config.bg} px-2 py-0.5 rounded-full`}>
      <Text className={`${config.text} text-[10px] font-medium`}>{config.label}</Text>
    </View>
  );
}

export default function CardiologueQueueScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);

  const { records, loading, refetch } = useCardiologistQueue(user?.id, 150);

  const filtered = useMemo(() => {
    let list = records;
    const uid = user?.id;
    if (chip === 'pool') {
      list = list.filter(
        r => (r.status === 'pending' || r.status === 'validated') && !r.assigned_to,
      );
    } else if (chip === 'mine') {
      list = list.filter(r => r.assigned_to === uid);
    } else if (chip === 'busy') {
      list = list.filter(
        r => r.assigned_to && r.assigned_to !== uid && (r.status === 'analyzing' || r.status === 'assigned'),
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        r =>
          (r.patient_name ?? '').toLowerCase().includes(q)
          || (r.reference ?? '').toLowerCase().includes(q)
          || (r.medical_center ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [records, chip, search, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-950" style={{ paddingTop: insets.top }}>
      <View className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <Text className="text-xl font-bold text-gray-900 dark:text-zinc-100">File ECG</Text>
        <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
          Demandes non terminées sur la plateforme
        </Text>
        <TextInput
          className="mt-3 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-zinc-100"
          placeholder="Rechercher patient, référence…"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 -mx-1">
          {FILTER_CHIPS.map(c => (
            <TouchableOpacity
              key={c.key}
              onPress={() => setChip(c.key)}
              className={`px-3 py-1.5 rounded-full mr-2 ${
                chip === c.key
                  ? 'bg-violet-600'
                  : 'bg-gray-100 dark:bg-zinc-800'
              }`}
            >
              <Text className={`text-xs font-semibold ${chip === c.key ? 'text-white' : 'text-gray-700 dark:text-zinc-300'}`}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={(
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={joyful.primary} />
        )}
      >
        {loading && records.length === 0 ? (
          <View className="py-20 items-center">
            <ActivityIndicator color={joyful.primary} size="large" />
          </View>
        ) : filtered.length === 0 ? (
          <Text className="text-center text-gray-500 dark:text-zinc-400 py-16 text-sm">
            Aucune demande pour ce filtre.
          </Text>
        ) : (
          filtered.map(item => {
            const isUrgent = item.urgency === 'urgent';
            const other = item.assigned_to && item.assigned_to !== user?.id;
            return (
              <View
                key={item.id}
                className={`bg-white dark:bg-zinc-900 rounded-2xl mb-3 border overflow-hidden ${
                  isUrgent ? 'border-red-200 dark:border-red-900' : 'border-gray-100 dark:border-zinc-800'
                } ${other ? 'opacity-80' : ''}`}
              >
                <TouchableOpacity
                  className="p-4"
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(cardiologue)/interpret/${item.id}` as Href)}
                >
                  <View className="flex-row items-start">
                    <View className={`w-10 h-10 rounded-full ${isUrgent ? 'bg-red-100' : 'bg-violet-100'} items-center justify-center mr-3`}>
                      <Text className={`text-xs font-bold ${isUrgent ? 'text-red-600' : 'text-violet-700'}`}>
                        {(item.patient_name ?? 'P').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-sm font-semibold text-gray-900 dark:text-zinc-100 flex-1 mr-2" numberOfLines={1}>
                          {item.patient_name}
                          {isUrgent ? ' ⚡' : ''}
                        </Text>
                        <StatusBadge status={item.status} />
                      </View>
                      <Text className="text-xs text-gray-500 dark:text-zinc-400 mb-1">{item.reference}</Text>
                      {item.clinical_context ? (
                        <Text className="text-xs text-gray-500 dark:text-zinc-400 mb-1" numberOfLines={2}>
                          {item.clinical_context}
                        </Text>
                      ) : null}
                      <Text className="text-xs text-gray-400 dark:text-zinc-500">
                        {item.medical_center} · {timeAgo(item.created_at)}
                        {other ? ' · autre cardiologue' : ''}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Bouton aperçu tracé */}
                <TouchableOpacity
                  className="flex-row items-center justify-center py-1.5 border-t border-gray-50 dark:border-zinc-800"
                  onPress={() => setExpandedTrace(prev => prev === item.id ? null : item.id)}
                  activeOpacity={0.7}
                >
                  <Text className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mr-1">
                    {expandedTrace === item.id ? 'Masquer le tracé' : 'Aperçu tracé'}
                  </Text>
                </TouchableOpacity>

                {expandedTrace === item.id && (
                  <View className="px-2 pb-2">
                    <ECGTraceView
                      ecgId={item.id}
                      files={(item as EcgRecordItem & { files?: { id: string; filename: string; file_url?: string; file_type: string }[] }).files}
                      height={150}
                      compact
                    />
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
