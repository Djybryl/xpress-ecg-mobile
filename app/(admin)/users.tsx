import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator, Alert,
  Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUsersList, type UserListItem, type UserRole } from '@/hooks/useUsersList';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/providers/AuthProvider';

const ROLE_CHIPS: { key: string; label: string }[] = [
  { key: 'all',         label: 'Tous' },
  { key: 'medecin',     label: 'Médecins' },
  { key: 'cardiologue', label: 'Cardiologues' },
  { key: 'secretaire',  label: 'Secrétaires' },
  { key: 'admin',       label: 'Admins' },
];

const ROLE_CONFIG: Record<UserRole, { label: string; bgColor: string; textColor: string }> = {
  medecin:     { label: 'Médecin',     bgColor: '#dbeafe', textColor: '#1d4ed8' },
  cardiologue: { label: 'Cardiologue', bgColor: '#ede9fe', textColor: '#5b21b6' },
  secretaire:  { label: 'Secrétaire',  bgColor: '#fce7f3', textColor: '#be185d' },
  admin:       { label: 'Admin',       bgColor: '#d1fae5', textColor: '#065f46' },
};

const STATUS_DOT: Record<string, { dot: string; text: string; label: string }> = {
  active:    { dot: '#22c55e', text: '#166534', label: 'Actif' },
  inactive:  { dot: '#9ca3af', text: '#6b7280', label: 'Inactif' },
  suspended: { dot: '#ef4444', text: '#991b1b', label: 'Suspendu' },
};

const INVITE_ROLES: { key: string; label: string }[] = [
  { key: 'medecin',     label: 'Médecin' },
  { key: 'cardiologue', label: 'Cardiologue' },
  { key: 'secretaire',  label: 'Secrétaire' },
];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function RoleBadge({ role }: { role: UserRole }) {
  const c = ROLE_CONFIG[role] ?? { label: role, bgColor: '#f3f4f6', textColor: '#374151' };
  return (
    <View style={{ backgroundColor: c.bgColor, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 }}>
      <Text style={{ fontSize: 9, fontWeight: '700', color: c.textColor }}>{c.label}</Text>
    </View>
  );
}

function StatusDot({ status }: { status: string }) {
  const c = STATUS_DOT[status] ?? STATUS_DOT.inactive;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.dot }} />
      <Text style={{ fontSize: 10, color: c.text, fontWeight: '600' }}>{c.label}</Text>
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
  const { user: currentUser } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Menu d'actions "···" ──────────────────────────────────
  const [actionMenuUser, setActionMenuUser] = useState<UserListItem | null>(null);

  // ── Modal invitation ──────────────────────────────────────
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

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

  const doToggle = useCallback((user: UserListItem) => {
    if (currentUser?.id && user.id === currentUser.id) {
      Alert.alert('Action impossible', "Vous ne pouvez pas modifier votre propre compte depuis l'application.");
      return;
    }
    const isActive = user.status === 'active';
    const endpoint = isActive ? `/users/${user.id}/deactivate` : `/users/${user.id}/activate`;
    const label = isActive ? 'Désactiver' : 'Réactiver';

    Alert.alert(
      `${label} ce compte`,
      `${label} le compte de ${user.full_name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: label,
          style: isActive ? 'destructive' : 'default',
          onPress: async () => {
            setActionMenuUser(null);
            setActionLoading(user.id);
            try {
              await api.post(endpoint, {});
              await refetch();
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }, [refetch, currentUser?.id]);

  const resetInviteForm = useCallback(() => {
    setInviteEmail('');
    setInviteRole('');
    setInviteFullName('');
    setInviteError(null);
  }, []);

  const handleSendInvitation = useCallback(async () => {
    if (!isValidEmail(inviteEmail)) {
      setInviteError('Adresse e-mail invalide.');
      return;
    }
    if (!inviteRole) {
      setInviteError('Veuillez sélectionner un rôle.');
      return;
    }
    setInviting(true);
    setInviteError(null);
    try {
      await api.post('/invitations', {
        email: inviteEmail.trim(),
        role: inviteRole,
        full_name: inviteFullName.trim() || undefined,
      });
      setInviteModal(false);
      resetInviteForm();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Invitation envoyée', `Invitation envoyée à ${inviteEmail.trim()}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Impossible d'envoyer l'invitation";
      if (msg.toLowerCase().includes('email_exists') || msg.toLowerCase().includes('already')) {
        setInviteError('Cette adresse e-mail est déjà utilisée.');
      } else {
        setInviteError(msg);
      }
    } finally {
      setInviting(false);
    }
  }, [inviteEmail, inviteRole, inviteFullName, resetInviteForm]);

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

              {/* Bouton "···" actions (pas sur son propre compte ni admin) */}
              {currentUser?.id === user.id ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 9, color: '#9ca3af', fontWeight: '600' }}>Vous</Text>
                </View>
              ) : actionLoading === user.id ? (
                <ActivityIndicator size="small" color={joyful.primary} style={{ marginLeft: 8 }} />
              ) : (
                <TouchableOpacity
                  onPress={() => setActionMenuUser(user)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 6, marginLeft: 4 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* FAB Inviter */}
      <TouchableOpacity
        onPress={() => { resetInviteForm(); setInviteModal(true); }}
        style={{
          position: 'absolute',
          bottom: insets.bottom + 24,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: joyful.primary,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 6,
          shadowColor: joyful.primary,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="person-add-outline" size={22} color="#fff" />
      </TouchableOpacity>

      {/* ── Modal menu d'actions "···" ──────────────────────── */}
      <Modal
        visible={actionMenuUser !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActionMenuUser(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          onPress={() => setActionMenuUser(null)}
        >
          <Pressable onPress={() => { /* absorbe tap */ }}>
            {actionMenuUser && (
              <View style={{
                backgroundColor: '#fff',
                borderTopLeftRadius: 24, borderTopRightRadius: 24,
                paddingBottom: insets.bottom + 12,
              }}>
                {/* Poignée */}
                <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb' }} />
                </View>

                {/* Identité */}
                <View style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }} numberOfLines={1}>
                    {actionMenuUser.full_name}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{actionMenuUser.email}</Text>
                </View>

                {/* Actions */}
                {actionMenuUser.status === 'active' ? (
                  <TouchableOpacity
                    onPress={() => doToggle(actionMenuUser)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 }}
                  >
                    <Ionicons name="person-remove-outline" size={20} color="#dc2626" />
                    <Text style={{ fontSize: 15, color: '#dc2626', fontWeight: '600' }}>Désactiver ce compte</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => doToggle(actionMenuUser)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 }}
                  >
                    <Ionicons name="person-add-outline" size={20} color="#16a34a" />
                    <Text style={{ fontSize: 15, color: '#16a34a', fontWeight: '600' }}>Réactiver ce compte</Text>
                  </TouchableOpacity>
                )}

                {/* Annuler */}
                <TouchableOpacity
                  onPress={() => setActionMenuUser(null)}
                  style={{ marginHorizontal: 20, marginTop: 4, paddingVertical: 13, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>Annuler</Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal invitation ────────────────────────────────── */}
      <Modal
        visible={inviteModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setInviteModal(false); resetInviteForm(); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
            onPress={() => { setInviteModal(false); resetInviteForm(); }}
          >
            <Pressable onPress={() => { /* absorbe tap */ }}>
              <View style={{
                backgroundColor: '#fff',
                borderTopLeftRadius: 24, borderTopRightRadius: 24,
                paddingBottom: insets.bottom + 16,
              }}>
                {/* Poignée */}
                <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb' }} />
                </View>

                {/* En-tête */}
                <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>Inviter un utilisateur</Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    Un e-mail d'invitation sera envoyé à l'adresse indiquée
                  </Text>
                </View>

                <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 14 }}>
                  {/* Email */}
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
                      Adresse e-mail <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    <TextInput
                      value={inviteEmail}
                      onChangeText={v => { setInviteEmail(v); setInviteError(null); }}
                      placeholder="exemple@clinique.cd"
                      placeholderTextColor="#9ca3af"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      style={{
                        backgroundColor: '#f9fafb',
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 11,
                        fontSize: 14,
                        color: '#111827',
                      }}
                    />
                  </View>

                  {/* Rôle */}
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                      Rôle <Text style={{ color: '#ef4444' }}>*</Text>
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {INVITE_ROLES.map(r => (
                        <TouchableOpacity
                          key={r.key}
                          onPress={() => { setInviteRole(r.key); setInviteError(null); }}
                          style={{
                            flex: 1,
                            paddingVertical: 9,
                            borderRadius: 10,
                            alignItems: 'center',
                            borderWidth: 1.5,
                            borderColor: inviteRole === r.key ? '#4f46e5' : '#e5e7eb',
                            backgroundColor: inviteRole === r.key ? '#ede9fe' : '#f9fafb',
                          }}
                        >
                          <Text style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: inviteRole === r.key ? '#4338ca' : '#6b7280',
                          }}>
                            {r.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Nom complet (optionnel) */}
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
                      Nom complet <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '400' }}>(optionnel)</Text>
                    </Text>
                    <TextInput
                      value={inviteFullName}
                      onChangeText={setInviteFullName}
                      placeholder="Dr. Prénom Nom"
                      placeholderTextColor="#9ca3af"
                      autoCapitalize="words"
                      style={{
                        backgroundColor: '#f9fafb',
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 11,
                        fontSize: 14,
                        color: '#111827',
                      }}
                    />
                  </View>

                  {/* Message d'erreur */}
                  {inviteError && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef2f2', padding: 10, borderRadius: 10 }}>
                      <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                      <Text style={{ fontSize: 12, color: '#dc2626', flex: 1 }}>{inviteError}</Text>
                    </View>
                  )}

                  {/* Bouton envoyer */}
                  <TouchableOpacity
                    onPress={() => void handleSendInvitation()}
                    disabled={inviting}
                    style={{
                      backgroundColor: inviting ? '#a5b4fc' : '#4f46e5',
                      paddingVertical: 14,
                      borderRadius: 14,
                      alignItems: 'center',
                      marginTop: 4,
                    }}
                    activeOpacity={0.85}
                  >
                    {inviting
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Envoyer l'invitation</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
