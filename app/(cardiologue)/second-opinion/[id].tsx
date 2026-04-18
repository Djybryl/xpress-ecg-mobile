import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { api, getApiErrorMessage } from '@/lib/apiClient';
import { fetchSecondOpinionById, type SecondOpinionItem } from '@/hooks/useSecondOpinions';

export default function SecondOpinionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors: joyful } = useTheme();
  const insets = useSafeAreaInsets();

  const [item, setItem] = useState<SecondOpinionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchSecondOpinionById(id);
      setItem(data);
      setResponseText(data.response ?? '');
    } catch (e) {
      Alert.alert('Erreur', getApiErrorMessage(e));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isConsultant = item && user?.id === item.consultant_id;
  const canRespond =
    isConsultant && item && (item.status === 'pending' || item.status === 'accepted');

  const handleAccept = () => {
    if (!id) return;
    Alert.alert('Accepter', 'Prendre en charge ce second avis ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Accepter',
        onPress: async () => {
          try {
            await api.patch(`/second-opinions/${id}/status`, { status: 'accepted' });
            await load();
          } catch (e) {
            Alert.alert('Erreur', getApiErrorMessage(e));
          }
        },
      },
    ]);
  };

  const handleRefuse = () => {
    if (!id) return;
    Alert.alert('Refuser', 'Refuser cette demande de second avis ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.patch(`/second-opinions/${id}/status`, { status: 'refused' });
            router.back();
          } catch (e) {
            Alert.alert('Erreur', getApiErrorMessage(e));
          }
        },
      },
    ]);
  };

  const handleSendResponse = async () => {
    if (!id || !responseText.trim()) {
      Alert.alert('Réponse requise', 'Saisissez votre avis.');
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/second-opinions/${id}/respond`, { response: responseText.trim() });
      Alert.alert('Envoyé', 'Votre réponse a été enregistrée.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Erreur', getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !id) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-zinc-950 items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator color={joyful.primary} size="large" />
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-zinc-950 p-6" style={{ paddingTop: insets.top }}>
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center mb-4">
          <Ionicons name="chevron-back" size={22} color={joyful.primary} />
          <Text style={{ color: joyful.primary, fontWeight: '600' }}>Retour</Text>
        </TouchableOpacity>
        <Text className="text-red-600">Second avis introuvable.</Text>
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
          Second avis — {item.status}
        </Text>
        <Text className="text-xs text-gray-500 mb-4">
          Dossier ECG : {item.ecg_record_id}
        </Text>

        <TouchableOpacity
          onPress={() => router.push(`/(cardiologue)/interpret/${item.ecg_record_id}` as Href)}
          className="bg-violet-100 dark:bg-violet-950/50 rounded-xl p-3 mb-4 flex-row items-center"
        >
          <Ionicons name="document-text" size={20} color="#6d28d9" />
          <Text className="text-violet-800 dark:text-violet-200 font-semibold ml-2">Ouvrir le dossier ECG</Text>
        </TouchableOpacity>

        {item.notes ? (
          <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mb-4 border border-gray-100 dark:border-zinc-800">
            <Text className="text-xs font-bold text-gray-400 uppercase mb-1">Demande</Text>
            <Text className="text-sm text-gray-800 dark:text-zinc-200">{item.notes}</Text>
          </View>
        ) : null}

        {isConsultant && item.status === 'pending' && (
          <View className="flex-row gap-3 mb-4">
            <TouchableOpacity
              onPress={handleAccept}
              className="flex-1 py-3 rounded-2xl bg-blue-600 items-center"
            >
              <Text className="text-white font-bold">Accepter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRefuse}
              className="flex-1 py-3 rounded-2xl border border-red-300 items-center"
            >
              <Text className="text-red-600 font-bold">Refuser</Text>
            </TouchableOpacity>
          </View>
        )}

        {canRespond && (
          <View className="mb-4">
            <Text className="text-sm font-bold text-gray-800 dark:text-zinc-100 mb-2">Votre avis</Text>
            <TextInput
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-zinc-100 min-h-[120px]"
              placeholder="Rédigez votre second avis…"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={responseText}
              onChangeText={setResponseText}
              editable={item.status !== 'completed'}
            />
            {item.status !== 'completed' && (
              <TouchableOpacity
                onPress={handleSendResponse}
                disabled={submitting}
                className="mt-3 py-3 rounded-2xl bg-violet-600 items-center"
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Envoyer la réponse</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {!isConsultant && (
          <View className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-4 border border-amber-200 dark:border-amber-800">
            <Text className="text-sm text-amber-900 dark:text-amber-100">
              Vous êtes le demandeur. Le consultant indiqué traitera la demande.
            </Text>
          </View>
        )}

        {item.response && item.status === 'completed' && (
          <View className="bg-white dark:bg-zinc-900 rounded-2xl p-4 mt-2 border border-gray-100 dark:border-zinc-800">
            <Text className="text-xs font-bold text-gray-400 uppercase mb-1">Réponse du consultant</Text>
            <Text className="text-sm text-gray-800 dark:text-zinc-200">{item.response}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
