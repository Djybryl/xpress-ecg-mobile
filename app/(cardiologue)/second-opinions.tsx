import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useSecondOpinions, type SecondOpinionItem } from '@/hooks/useSecondOpinions';

const FILTERS: { key: '' | SecondOpinionItem['status']; label: string }[] = [
  { key: '', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'accepted', label: 'Acceptés' },
  { key: 'completed', label: 'Répondus' },
  { key: 'refused', label: 'Refusés' },
];

function OpinionCard({
  item,
  currentUserId,
}: {
  item: SecondOpinionItem;
  currentUserId: string;
}) {
  const isIncoming = item.consultant_id === currentUserId;
  const statusColor =
    item.status === 'completed' ? '#16a34a' :
    item.status === 'refused' ? '#dc2626' :
    item.status === 'accepted' ? '#2563eb' : '#d97706';

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(cardiologue)/second-opinion/${item.id}` as Href)}
      className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 border border-gray-100 dark:border-zinc-800"
      activeOpacity={0.85}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View
          className="px-2 py-0.5 rounded-full"
          style={{ backgroundColor: isIncoming ? '#ede9fe' : '#e0f2fe' }}
        >
          <Text className="text-[10px] font-bold" style={{ color: isIncoming ? '#6d28d9' : '#0369a1' }}>
            {isIncoming ? 'À traiter (consultant)' : 'Ma demande'}
          </Text>
        </View>
        <Text className="text-[10px] font-semibold uppercase" style={{ color: statusColor }}>
          {item.status}
        </Text>
      </View>
      <Text className="text-sm font-semibold text-gray-900 dark:text-zinc-100" numberOfLines={1}>
        Dossier {item.ecg_record_id.slice(0, 8)}…
      </Text>
      {item.notes ? (
        <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-1" numberOfLines={2}>
          {item.notes}
        </Text>
      ) : null}
      <Text className="text-[10px] text-gray-400 mt-2">
        {new Date(item.created_at).toLocaleString('fr-FR')}
      </Text>
    </TouchableOpacity>
  );
}

export default function SecondOpinionsScreen() {
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'' | SecondOpinionItem['status']>('');
  const [search, setSearch] = useState('');

  const { items, loading, error, refetch } = useSecondOpinions({
    status: filter || undefined,
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      i =>
        i.ecg_record_id.toLowerCase().includes(q) ||
        (i.notes ?? '').toLowerCase().includes(q),
    );
  }, [items, search]);

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-950" style={{ paddingTop: insets.top }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
          borderBottomWidth: 2,
          borderBottomColor: joyful.tabBarBorder,
          backgroundColor: joyful.stepBarBg,
        }}
      >
        <Text className="text-xl font-bold mb-3" style={{ color: joyful.primaryDark }}>
          Second avis
        </Text>
        <View className="flex-row items-center bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 h-10 mb-3 border border-transparent dark:border-zinc-700">
          <Text className="text-gray-400 mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-sm text-gray-800 dark:text-zinc-100"
            placeholder="Filtrer par ID dossier, notes…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key || 'all'}
              onPress={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full border ${
                filter === f.key
                  ? 'bg-violet-600 border-violet-600'
                  : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-600'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  filter === f.key ? 'text-white' : 'text-gray-600 dark:text-zinc-300'
                }`}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {error && !loading ? (
        <View className="mx-4 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
          <Text className="text-red-700 dark:text-red-400 text-xs">{error}</Text>
          <TouchableOpacity onPress={onRefresh} className="mt-2">
            <Text className="text-red-600 text-xs font-semibold underline">Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && !items.length ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={joyful.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshControl={
            <RefreshControl refreshing={loading && items.length > 0} onRefresh={onRefresh} tintColor={joyful.primary} />
          }
        >
          {filtered.length === 0 ? (
            <View className="items-center mt-16 px-6">
              <Text className="text-4xl mb-3">💬</Text>
              <Text className="text-gray-600 dark:text-zinc-400 text-center">
                Aucun second avis pour ces critères.
              </Text>
            </View>
          ) : (
            filtered.map(item => (
              <OpinionCard key={item.id} item={item} currentUserId={user?.id ?? ''} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
