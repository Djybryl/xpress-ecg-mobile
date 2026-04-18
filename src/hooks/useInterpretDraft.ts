/**
 * Sauvegarde / restaure automatiquement le brouillon d'interprétation dans AsyncStorage.
 * Clé : `ecg_draft_<ecgId>`. Supprimé après soumission réussie.
 */
import { useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface InterpretDraft {
  rhythm: string;
  axis: string;
  heartRate: string;
  prInterval: string;
  qrsDuration: string;
  qtInterval: string;
  observations: string;
  conclusion: string;
  signConfirmed: boolean;
  updatedAt: number;
}

const STORAGE_PREFIX = 'ecg_draft_';

function storageKey(ecgId: string) {
  return `${STORAGE_PREFIX}${ecgId}`;
}

export function useInterpretDraft(ecgId: string | undefined) {
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restore = useCallback(async (): Promise<InterpretDraft | null> => {
    if (!ecgId) return null;
    try {
      const raw = await AsyncStorage.getItem(storageKey(ecgId));
      if (!raw) return null;
      return JSON.parse(raw) as InterpretDraft;
    } catch {
      return null;
    }
  }, [ecgId]);

  const save = useCallback(
    (draft: Omit<InterpretDraft, 'updatedAt'>) => {
      if (!ecgId) return;
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => {
        const payload: InterpretDraft = { ...draft, updatedAt: Date.now() };
        AsyncStorage.setItem(storageKey(ecgId), JSON.stringify(payload)).catch(() => {});
      }, 800);
    },
    [ecgId],
  );

  const discard = useCallback(async () => {
    if (!ecgId) return;
    if (debounce.current) clearTimeout(debounce.current);
    await AsyncStorage.removeItem(storageKey(ecgId)).catch(() => {});
  }, [ecgId]);

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  return { restore, save, discard };
}
