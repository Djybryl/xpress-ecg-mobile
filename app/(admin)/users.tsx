import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUsersList, type UserListItem, type UserRole } from '@/hooks/useUsersList';
import { api } from '@/lib/apiClient';

const ROLE_CHIPS: { key: string; label: string }[] = [
  { key: 'all',        label: 'Tous' },
  { key: 'medecin',    label: 'Médecins' },
  { key: 'cardiologue', label: 'Cardiologues' },
  { key: 'secretaire', label: 'Secrétaires' },
  { key: 'admin',      label: 'Admins' },
];

const ROLE_CONFIG: Record<UserRole, { label: string; bgColor: string; textColor: string }> = {
  medecin:     { label: 'Médecin',     bgColor: '#dbeafe', textColor: '#1d4ed8' },
  cardiologue: { label: 'Cardiologue', bgColor: '#ede9fe', textColor: '#5b21b6' },
  secretaire:  { label: 'Secrétaire',  bgColor: '#fce7f3', textColor: '#be185d' },
  admin:       { label: 'Admin',       bgColor: '#d1fae5', textColor: '#065f46' },
};

function RoleBadge({ role }: { role: UserRole }) {
  const c = ROLE_CONFIG[role] ?? { label: role, bgColor: '#f3f4f6', textColor: '#374151' };
  return (
    <View style={{ backgroundColor: c.bgColor, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 }}>
      <Text style={{ fontSize: 9, fontWeight: '700', color: c.textColor }}>{c.label}</Text>
    </View>
  );
}

function StatusDot({ status }: { status: string }) {
  const isActive = status === 'active';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isActive ? '#22c55e' : '#ef4444' }} />
      <Text style={{ fontSize: 10, color: isActive ? '#166534' : '#991b1b', fontWeight: '600' }}>
        {isActive ? 'Actif' : 'Inactif'}
      </Text>
    </View>
  );
}

function getInitials(name: string): string {
  const stripped = name.replace(/^(\s*(Dr\.?\s+|Pr\.?\s+))+/i, '').trim();
  const parts = stripped.split(' ').filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
}

export default function AdminUsers() {
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const roleParam = roleFilter === 'all' ? undefined : roleFilter;
  const { users, total, loading, refetch } = useUsersList({ role: roleParam, limit: 200 });

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const doToggle = useCallback(async (user: UserListItem) => {
    const isActive = user.status === 'active';
    const endpoint = isActive
      ? `/users/${user.id}/deactivate`
      : `/users/${user.id}/activate`;
    const label = isActive ? 'Désactiver' : 'Activer';

    Alert.alert(
      `${label} cet utilisateur`,
      `${label} le compte de ${user.full_name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: label,
          style: isActive ? 'destructive' : 'default',
          onPress: async () => {
            setActionLoading(user.id);
            try {
              await api.post(endpoint, {});
              await refetch();
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }, [refetch]);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-950" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 pt-3 pb-3 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-xl font-bold text-gray-900 dark:text-zinc-100">Utilisateurs</Text>
            <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              {loading ? '…' : `${total} compte${total > 1 ? 's' : ''}`}
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
          placeholder="Rechercher nom, email…"
          placeholderTextColor="#9ca3af"
          className="bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-zinc-100 mb-3"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {ROLE_CHIPS.map(chip => (
            <TouchableOpacity
              key={chip.key}
              onPress={() => setRoleFilter(chip.key)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: roleFilter === chip.key ? joyful.primary : '#f3f4f6' }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: roleFilter === chip.key ? '#fff' : '#6b7280' }}>
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
            <Ionicons name="people-outline" size={48} color="#9ca3af" />
            <Text className="mt-3 text-gray-400 dark:text-zinc-500 text-sm">Aucun utilisateur</Text>
          </View>
        )}

        {filtered.map(user => (
          <View
            key={user.id}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-2 shadow-sm"
          >
            <View className="flex-row items-center">
              {/* Avatar */}
              <View
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: joyful.primaryMuted, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: joyful.primary }}>
                  {getInitials(user.full_name)}
                </Text>
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-[14px] font-bold text-gray-900 dark:text-zinc-100" numberOfLines={1}>
                    {user.full_name}
                  </Text>
                  <RoleBadge role={user.role} />
                </View>
                <Text className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5" numberOfLines={1}>
                  {user.email}
                </Text>
                <View className="mt-1.5">
                  <StatusDot status={user.status} />
                </View>
              </View>

              {/* Toggle button */}
              <TouchableOpacity
                onPress={() => doToggle(user)}
                disabled={actionLoading === user.id}
                style={{
                  backgroundColor: user.status === 'active' ? '#fee2e2' : '#d1fae5',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 32,
                }}
              >
                {actionLoading === user.id ? (
                  <ActivityIndicator size="small" color={user.status === 'active' ? '#dc2626' : '#065f46'} />
                ) : (
                  <Ionicons
                    name={user.status === 'active' ? 'ban' : 'checkmark-circle'}
                    size={16}
                    color={user.status === 'active' ? '#dc2626' : '#065f46'}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
