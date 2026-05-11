import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/providers/AuthProvider';
import { api, getApiErrorMessage } from '@/lib/apiClient';
import { useToast } from '@/providers/ToastProvider';

const DRAFT_KEY = 'xecg-credit-request-draft';
const ECG_PER_PACK_EST = 10;
const TARIF_ECG_EST_FCFA = 5000;

type DraftShape = { nb_paquets: number; file_label?: string };

export default function CreditRequestScreen() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const maxPacks = user?.role === 'admin' ? 10 : 3;
  const [nb, setNb] = useState(1);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const montantEst = nb * ECG_PER_PACK_EST * TARIF_ECG_EST_FCFA;

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const d = JSON.parse(raw) as DraftShape;
        if (d.nb_paquets >= 1 && d.nb_paquets <= maxPacks) setNb(d.nb_paquets);
        if (d.file_label) setPdfName(d.file_label);
      } catch {
        /* ignore */
      }
    })();
  }, [maxPacks]);

  const persistDraft = useCallback(async (nextNb: number, label: string | null) => {
    try {
      const payload: DraftShape = { nb_paquets: nextNb, file_label: label ?? undefined };
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, []);

  const pickPdf = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const uri = a.uri;
      const name = a.name ?? 'formulaire.pdf';
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && info.size != null && info.size > 5 * 1024 * 1024) {
        toastError('Le PDF ne doit pas dépasser 5 Mo.');
        return;
      }
      if (a.mimeType && a.mimeType !== 'application/pdf') {
        toastError('Seuls les fichiers PDF sont acceptés.');
        return;
      }
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      if (!b64.startsWith('JVBER')) {
        toastError('Fichier PDF invalide.');
        return;
      }
      setPdfName(name);
      setPdfBase64(b64);
      void persistDraft(nb, name);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Impossible de lire le fichier');
    }
  }, [nb, persistDraft, toastError]);

  const setNbWrapped = (v: number) => {
    const clamped = Math.min(maxPacks, Math.max(1, v));
    setNb(clamped);
    void persistDraft(clamped, pdfName);
  };

  const submitDisabled = pdfBase64 == null || submitting;

  const onSubmit = async () => {
    if (pdfBase64 == null) return;
    setSubmitting(true);
    try {
      const out = await api.post<{ requestId: string; status: string }>('/credits/request', {
        nb_paquets: nb,
        formulaire_base64: pdfBase64,
      });
      toastSuccess(`Demande ${out.requestId} envoyée.`);
      await AsyncStorage.removeItem(DRAFT_KEY).catch(() => null);
    } catch (e) {
      toastError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white dark:bg-zinc-900" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: 'Demande de crédits' }} />
      <Text accessibilityRole="header" className="text-lg font-bold text-slate-900 dark:text-zinc-100 mb-2">
        Nombre de paquets
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {Array.from({ length: maxPacks }, (_, i) => i + 1).map((n) => (
          <TouchableOpacity
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n} paquet${n > 1 ? 's' : ''}`}
            accessibilityState={{ selected: nb === n }}
            className={`px-4 py-2 rounded-xl border ${nb === n ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-zinc-600'}`}
            onPress={() => setNbWrapped(n)}
          >
            <Text className={`font-semibold ${nb === n ? 'text-white' : 'text-slate-800 dark:text-zinc-100'}`}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="text-slate-600 dark:text-slate-400 text-sm mb-4">
        Montant estimé (validation serveur) :{' '}
        <Text className="font-bold text-slate-900 dark:text-zinc-100">
          {montantEst.toLocaleString('fr-FR')} FCFA
        </Text>{' '}
        ({nb} × {ECG_PER_PACK_EST} ECG × {TARIF_ECG_EST_FCFA} FCFA)
      </Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Choisir le formulaire PDF"
        className="border-2 border-dashed border-indigo-300 rounded-xl py-4 px-3 items-center mb-2"
        onPress={pickPdf}
      >
        <Text className="text-indigo-700 dark:text-indigo-300 font-semibold">Choisir le formulaire (PDF)</Text>
        {pdfName ? (
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-2" numberOfLines={2}>
            {pdfName}
          </Text>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Envoyer la demande de crédits"
        accessibilityState={{ disabled: submitDisabled }}
        disabled={submitDisabled}
        className={`rounded-xl py-4 items-center mt-4 ${submitDisabled ? 'bg-slate-300' : 'bg-indigo-600'}`}
        onPress={onSubmit}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold">Envoyer la demande</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
