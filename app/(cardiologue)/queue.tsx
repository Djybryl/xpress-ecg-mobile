import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useCardiologistQueue } from '@/hooks/useCardiologistQueue';
import { api, getApiErrorMessage } from '@/lib/apiClient';
import { useTranslation } from '@/i18n';
import type { EcgRecordItem } from '@/hooks/useEcgList';

const FILTER_CHIPS: { key: string; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'pool', label: 'À prendre' },
  { key: 'urgent', label: '⚡ Urgents' },
  { key: 'busy', label: 'En cours' },
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
      <View className="bg-blue-100 px-2 py-0.5 rounded-full">
        <Text className="text-blue-700 text-[10px] font-medium">En analyse</Text>
      </View>
    );
  }
  if (status === 'completed') {
    return (
      <View className="bg-green-100 px-2 py-0.5 rounded-full">
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
    <View className={`${config.bg} px-2 py-0.5 rounded-full`}>
      <Text className={`${config.text} text-[10px] font-medium`}>{config.label}</Text>
    </View>
  );
}

export default function CardiologueQueueScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const [activeFilter, setActiveFilter] = useState(() => (filter === 'urgent' ? 'urgent' : 'all'));
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [takingId, setTakingId] = useState<string | null>(null);

  useEffect(() => {
    if (filter === 'urgent') setActiveFilter('urgent');
  }, [filter]);

  const { records, loading, refetch } = useCardiologistQueue(user?.id, 150);

  // Règle métier (cf. web PendingECG) : 1 seul ECG en cours par cardiologue.
  const myInProgressId = useMemo(
    () => records.find(r => r.status === 'analyzing' && r.assigned_to === user?.id)?.id ?? null,
    [records, user?.id],
  );

  const handleTake = useCallback(async (item: EcgRecordItem) => {
    if (!user?.id) return;
    if (myInProgressId && myInProgressId !== item.id) {
      Alert.alert(t.queue.oneAtATimeTitle, t.queue.oneAtATime);
      return;
    }
    setTakingId(item.id);
    try {
      await api.post(`/ecg-records/${item.id}/start-analysis`);
      await refetch();
      router.push(`/(cardiologue)/interpret/${item.id}` as Href);
    } catch (e) {
      Alert.alert(t.common.error, getApiErrorMessage(e));
    } finally {
      setTakingId(null);
    }
  }, [user?.id, myInProgressId, refetch, t.queue.oneAtATimeTitle, t.queue.oneAtATime, t.common.error]);

  const handleContinue = useCallback((id: string) => {
    router.push(`/(cardiologue)/interpret/${id}` as Href);
  }, []);

  const filtered = useMemo(() => {
    let list = records;
    if (activeFilter === 'pool') {
      list = list.filter(r => r.status === 'pending' && !r.assigned_to);
    } else if (activeFilter === 'urgent') {
      list = list.filter(r => r.urgency === 'urgent' && r.status !== 'completed');
    } else if (activeFilter === 'busy') {
      list = list.filter(r => r.status === 'analyzing');
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
  }, [records, activeFilter, search]);

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
              onPress={() => setActiveFilter(c.key)}
              className={`px-3 py-1.5 rounded-full mr-2 ${
                activeFilter === c.key
                  ? 'bg-violet-600'
                  : 'bg-gray-100 dark:bg-zinc-800'
              }`}
            >
              <Text className={`text-xs font-semibold ${activeFilter === c.key ? 'text-white' : 'text-gray-700 dark:text-zinc-300'}`}>
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
            const other = !!item.assigned_to && item.assigned_to !== user?.id && item.status !== 'completed';
            const isMine = item.status === 'analyzing' && item.assigned_to === user?.id;
            const isCompleted = item.status === 'completed';
            const isLoadingTake = takingId === item.id;
            const blockedByOther = !!myInProgressId && myInProgressId !== item.id && !isMine && !other && !isCompleted;

            const renderAction = () => {
              if (isCompleted) {
                return (
                  <View className="px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Text className="text-[11px] font-semibold text-green-700 dark:text-green-300">
                      {t.queue.completedShort}
                    </Text>
                  </View>
                );
              }
              if (other) {
                return (
                  <View className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-zinc-800">
                    <Text className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
                      {t.queue.takenByOther}
                    </Text>
                  </View>
                );
              }
              if (isMine) {
                return (
                  <TouchableOpacity
                    onPress={() => handleContinue(item.id)}
                    className="bg-blue-600 px-3 py-1.5 rounded-full flex-row items-center"
                    accessibilityRole="button"
                    accessibilityLabel={t.queue.continueLabel}
                  >
                    <Ionicons name="arrow-forward" size={12} color="white" />
                    <Text className="ml-1 text-[11px] font-semibold text-white">
                      {t.queue.continueLabel}
                    </Text>
                  </TouchableOpacity>
                );
              }
              if (blockedByOther) {
                return (
                  <TouchableOpacity
                    onPress={() => Alert.alert(t.queue.oneAtATimeTitle, t.queue.oneAtATime)}
                    className="bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full flex-row items-center"
                    accessibilityRole="button"
                    accessibilityLabel={t.queue.take}
                    accessibilityState={{ disabled: true }}
                  >
                    <Ionicons name="play" size={12} color="#9ca3af" />
                    <Text className="ml-1 text-[11px] font-semibold text-gray-400 dark:text-zinc-500">
                      {t.queue.take}
                    </Text>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  onPress={() => handleTake(item)}
                  disabled={isLoadingTake}
                  className={`${isUrgent ? 'bg-red-600' : 'bg-violet-600'} px-3 py-1.5 rounded-full flex-row items-center`}
                  accessibilityRole="button"
                  accessibilityLabel={t.queue.take}
                >
                  {isLoadingTake ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="play" size={12} color="white" />
                      <Text className="ml-1 text-[11px] font-semibold text-white">
                        {t.queue.take}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            };

            return (
              <View
                key={item.id}
                className={`bg-white dark:bg-zinc-900 rounded-2xl mb-3 border overflow-hidden ${
                  isUrgent ? 'border-red-200 dark:border-red-900' : 'border-gray-100 dark:border-zinc-800'
                } ${other ? 'opacity-75' : ''}`}
              >
                <View className="p-4">
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
                        <StatusBadge item={item} />
                      </View>
                      <Text className="text-xs text-gray-500 dark:text-zinc-400 mb-1">{item.reference}</Text>
                      {item.clinical_context ? (
                        <Text className="text-xs text-gray-600 dark:text-zinc-300 mb-1" numberOfLines={3}>
                          {item.clinical_context}
                        </Text>
                      ) : null}
                      <Text className="text-xs text-gray-400 dark:text-zinc-500">
                        {item.medical_center} · {timeAgo(item.created_at)}
                        {other ? ` · ${t.queue.otherCardiologist}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="flex-row items-center justify-end px-3 py-2 border-t border-gray-50 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/60">
                  {renderAction()}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
