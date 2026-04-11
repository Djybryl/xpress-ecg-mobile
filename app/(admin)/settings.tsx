import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Switch, TextInput, Alert,
} from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAdminSettings } from '@/hooks/useAdminSettings';

interface SettingField {
  key: string;
  label: string;
  description: string;
  type: 'text' | 'number' | 'boolean';
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
}

const SETTING_FIELDS: SettingField[] = [
  {
    key: 'platform_name',
    label: 'Nom de la plateforme',
    description: 'Nom affiché dans les notifications et emails',
    type: 'text',
    icon: 'business',
    iconBg: '#dbeafe',
    iconColor: '#1d4ed8',
  },
  {
    key: 'rgpd_contact_email',
    label: 'Email RGPD',
    description: 'Email de contact pour les demandes RGPD',
    type: 'text',
    icon: 'mail',
    iconBg: '#ede9fe',
    iconColor: '#5b21b6',
  },
  {
    key: 'rgpd_contact_address',
    label: 'Adresse RGPD',
    description: 'Adresse postale du responsable des données',
    type: 'text',
    icon: 'location',
    iconBg: '#fce7f3',
    iconColor: '#be185d',
  },
  {
    key: 'provisional_window_hours',
    label: 'Fenêtre provisoire (h)',
    description: 'Durée d\'accès provisoire après inscription (heures)',
    type: 'number',
    icon: 'time',
    iconBg: '#fef3c7',
    iconColor: '#d97706',
  },
  {
    key: 'invitation_validity_days',
    label: 'Validité invitation (j)',
    description: 'Durée de validité des invitations (jours)',
    type: 'number',
    icon: 'calendar',
    iconBg: '#d1fae5',
    iconColor: '#065f46',
  },
  {
    key: 'minimal_deposit_deadline_days',
    label: 'Délai dépôt minimal (j)',
    description: 'Délai pour déposer le minimum de justificatifs',
    type: 'number',
    icon: 'document',
    iconBg: '#e0f2fe',
    iconColor: '#0369a1',
  },
  {
    key: 'complete_dossier_deadline_days',
    label: 'Délai dossier complet (j)',
    description: 'Délai pour compléter le dossier prescripteur',
    type: 'number',
    icon: 'folder',
    iconBg: '#fef9c3',
    iconColor: '#a16207',
  },
  {
    key: 'scan_retention_months',
    label: 'Rétention scans (mois)',
    description: 'Durée de conservation des fichiers ECG en mois',
    type: 'number',
    icon: 'archive',
    iconBg: '#f3e8ff',
    iconColor: '#7c3aed',
  },
  {
    key: 'maintenance_mode',
    label: 'Mode maintenance',
    description: 'Active/désactive le mode maintenance de la plateforme',
    type: 'boolean',
    icon: 'construct',
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
  },
];

export default function AdminSettings() {
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Record<string, string | number | boolean>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const { config, loading, saving, save, refetch } = useAdminSettings(true);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPendingEdits({});
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getEffectiveValue = (key: string) => {
    if (key in pendingEdits) return pendingEdits[key];
    return config[key];
  };

  const handleBoolToggle = (key: string, newVal: boolean) => {
    setPendingEdits(prev => ({ ...prev, [key]: newVal }));
  };

  const handleTextChange = (key: string, val: string, type: 'text' | 'number') => {
    const parsed = type === 'number' ? (val === '' ? '' : Number(val)) : val;
    setPendingEdits(prev => ({ ...prev, [key]: parsed }));
  };

  const hasPendingEdits = Object.keys(pendingEdits).length > 0;

  const handleSave = useCallback(async () => {
    if (!hasPendingEdits) return;
    const ok = await save(pendingEdits);
    if (ok) {
      setPendingEdits({});
      Alert.alert('Sauvegardé', 'Les paramètres ont été mis à jour.');
    } else {
      Alert.alert('Erreur', 'Impossible de sauvegarder les paramètres.');
    }
  }, [pendingEdits, save, hasPendingEdits]);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-950" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 pt-3 pb-3 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-bold text-gray-900 dark:text-zinc-100">Paramètres système</Text>
            <Text className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Configuration de la plateforme</Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            style={{ backgroundColor: joyful.primaryMuted, padding: 8, borderRadius: 10 }}
          >
            <Ionicons name="refresh" size={16} color={joyful.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={joyful.primary} />}
      >
        {loading && !refreshing && (
          <ActivityIndicator color={joyful.primary} style={{ marginTop: 40 }} />
        )}

        {!loading && SETTING_FIELDS.map(field => {
          const value = getEffectiveValue(field.key);
          const isDirty = field.key in pendingEdits;
          const isEditing = editingKey === field.key;

          return (
            <View
              key={field.key}
              className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-3 shadow-sm"
              style={{ borderWidth: isDirty ? 1.5 : 0, borderColor: isDirty ? joyful.primary : 'transparent' }}
            >
              <View className="flex-row items-start">
                <View
                  style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: field.iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}
                >
                  <Ionicons name={field.icon} size={16} color={field.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-[13px] font-bold text-gray-900 dark:text-zinc-100">{field.label}</Text>
                    {isDirty && (
                      <View style={{ backgroundColor: joyful.primaryMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ fontSize: 9, color: joyful.primary, fontWeight: '700' }}>Modifié</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-[11px] text-gray-500 dark:text-zinc-400 mb-2">{field.description}</Text>

                  {field.type === 'boolean' ? (
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[12px] text-gray-700 dark:text-zinc-300">
                        {value ? 'Activé' : 'Désactivé'}
                      </Text>
                      <Switch
                        value={!!value}
                        onValueChange={v => handleBoolToggle(field.key, v)}
                        trackColor={{ false: '#d1d5db', true: joyful.primary }}
                        thumbColor="#fff"
                      />
                    </View>
                  ) : isEditing ? (
                    <View className="flex-row items-center gap-2">
                      <TextInput
                        autoFocus
                        value={String(value ?? '')}
                        onChangeText={v => handleTextChange(field.key, v, field.type as 'text' | 'number')}
                        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                        className="flex-1 bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100"
                        onBlur={() => setEditingKey(null)}
                      />
                      <TouchableOpacity onPress={() => setEditingKey(null)}>
                        <Ionicons name="checkmark-circle" size={22} color={joyful.primary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setEditingKey(field.key)}
                      className="bg-gray-50 dark:bg-zinc-800 rounded-xl px-3 py-2 flex-row items-center justify-between"
                    >
                      <Text className="text-[13px] text-gray-800 dark:text-zinc-200 flex-1" numberOfLines={1}>
                        {value !== undefined && value !== '' ? String(value) : '—'}
                      </Text>
                      <Ionicons name="pencil" size={13} color="#9ca3af" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Save button */}
      {hasPendingEdits && (
        <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 16, right: 16 }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: joyful.primary, borderRadius: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 6, shadowColor: joyful.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8 }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                  Enregistrer les modifications
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
