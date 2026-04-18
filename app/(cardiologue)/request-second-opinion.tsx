import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveCardiologues } from '@/hooks/useActiveCardiologues';
import { api, getApiErrorMessage } from '@/lib/apiClient';

export default function RequestSecondOpinionScreen() {
  const { ecg_record_id } = useLocalSearchParams<{ ecg_record_id: string }>();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();

  const { users, loading: usersLoading } = useActiveCardiologues();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    if (!ecg_record_id) {
      Alert.alert('Erreur', 'Identifiant de dossier manquant.');
      return;
    }
    if (selected.size === 0) {
      Alert.alert('Consultants', 'Sélectionnez au moins un cardiologue.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/second-opinions', {
        ecg_record_id,
        consultant_ids: Array.from(selected),
        notes: notes.trim() || undefined,
      });
      Alert.alert('Demande envoyée', 'Les destinataires ont été notifiés.', [
        { text: 'OK', onPress: () => router.replace('/(cardiologue)/second-opinions' as Href) },
      ]);
    } catch (e) {
      Alert.alert('Erreur', getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!ecg_record_id) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-zinc-950 p-6 justify-center" style={{ paddingTop: insets.top }}>
        <Text className="text-red-600">Paramètre ecg_record_id manquant.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text style={{ color: joyful.primary }}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-950" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center">
          <Ionicons name="chevron-back" size={22} color={joyful.primary} />
          <Text style={{ color: joyful.primary, fontWeight: '600' }}>Retour</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Text className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-1">
          Demander un second avis
        </Text>
        <Text className="text-xs text-gray-500 mb-4">Dossier : {ecg_record_id}</Text>

        <Text className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-2">
          Cardiologues consultants
        </Text>
        {usersLoading ? (
          <ActivityIndicator color={joyful.primary} style={{ marginVertical: 16 }} />
        ) : users.length === 0 ? (
          <Text className="text-sm text-gray-500 dark:text-zinc-400 mb-2">
            Aucun autre cardiologue actif n’est disponible pour votre établissement.
          </Text>
        ) : (
          users.map(c => (
            <TouchableOpacity
              key={c.id}
              onPress={() => toggle(c.id)}
              className={`flex-row items-center p-3 mb-2 rounded-xl border ${
                selected.has(c.id)
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40'
                  : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
              }`}
            >
              <Ionicons
                name={selected.has(c.id) ? 'checkbox' : 'square-outline'}
                size={22}
                color={selected.has(c.id) ? '#7c3aed' : '#9ca3af'}
              />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{c.full_name}</Text>
                <Text className="text-xs text-gray-500">{c.email}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <Text className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mt-4 mb-2">Notes (optionnel)</Text>
        <TextInput
          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-zinc-100 min-h-[88px]"
          placeholder="Contexte ou question pour le consultant…"
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || selected.size === 0}
          className={`mt-6 py-3 rounded-2xl items-center ${selected.size === 0 ? 'bg-gray-300' : 'bg-violet-600'}`}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold">Envoyer la demande</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
