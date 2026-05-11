import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { api, getApiErrorMessage } from '@/lib/apiClient';

interface MemberUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface MemberRow {
  id: string;
  institution_id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  user?: MemberUser;
}

function statusBadge(status: string): { wrap: string; labelCls: string } {
  switch (status) {
    case 'active':
      return { wrap: 'bg-emerald-100 dark:bg-emerald-900', labelCls: 'text-emerald-800 dark:text-emerald-200' };
    case 'pending_accept':
    case 'pending_admin':
      return { wrap: 'bg-amber-100 dark:bg-amber-900', labelCls: 'text-amber-900 dark:text-amber-100' };
    default:
      return { wrap: 'bg-slate-100 dark:bg-slate-800', labelCls: 'text-slate-700 dark:text-slate-200' };
  }
}

export default function InstitutionMembersScreen() {
  const { user } = useAuth();
  const institutionId = user?.institutionId ?? '';
  const canInvite = user?.role === 'secretaire' || user?.role === 'admin';

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!institutionId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await api.get<{ members: MemberRow[] }>(`/institutions/${institutionId}/members`);
      setMembers(res.members ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [institutionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onInvite = async () => {
    if (!institutionId || !email.trim()) return;
    setInviting(true);
    setError(null);
    try {
      await api.post(`/institutions/${institutionId}/members/invite`, {
        email: email.trim().toLowerCase(),
      });
      setEmail('');
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setInviting(false);
    }
  };

  if (!institutionId) {
    return (
      <View className="flex-1 p-5 justify-center bg-white dark:bg-zinc-900">
        <Stack.Screen options={{ title: 'Membres' }} />
        <Text className="text-center text-slate-600">Institution non disponible.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <Stack.Screen options={{ title: 'Membres' }} />
      {canInvite ? (
        <View className="p-4 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
          <Text className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Inviter par email</Text>
          <TextInput
            accessibilityLabel="Email du membre à inviter"
            keyboardType="email-address"
            autoCapitalize="none"
            className="border border-slate-200 dark:border-zinc-600 rounded-xl px-3 py-2 text-slate-900 dark:text-zinc-100 mb-2"
            value={email}
            onChangeText={setEmail}
            placeholder="collegue@etablissement.cg"
            placeholderTextColor="#9ca3af"
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Envoyer l'invitation"
            accessibilityState={{ disabled: inviting || !email.trim() }}
            disabled={inviting || !email.trim()}
            className={`rounded-xl py-3 items-center ${inviting || !email.trim() ? 'bg-slate-300' : 'bg-indigo-600'}`}
            onPress={onInvite}
          >
            {inviting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Inviter</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" className="text-red-600 text-sm px-4 pt-2">
          {error}
        </Text>
      ) : null}

      {loading && members.length === 0 ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const st = statusBadge(item.status);
            return (
            <View className="bg-white dark:bg-zinc-900 rounded-xl p-3 mb-2 border border-slate-100 dark:border-zinc-800">
              <Text className="font-semibold text-slate-900 dark:text-zinc-100">
                {item.user?.full_name ?? item.user?.email ?? item.user_id}
              </Text>
              <Text className="text-xs text-slate-500">{item.user?.email}</Text>
              <View className={`self-start mt-2 px-2 py-0.5 rounded-full ${st.wrap}`}>
                <Text className={`text-[11px] font-bold ${st.labelCls}`}>{item.status}</Text>
              </View>
            </View>
            );
          }}
          ListEmptyComponent={<Text className="text-slate-500 text-center">Aucun membre.</Text>}
        />
      )}
    </View>
  );
}
