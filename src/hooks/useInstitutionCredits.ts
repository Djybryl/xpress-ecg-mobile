import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, getApiErrorMessage } from '@/lib/apiClient';

export interface InstitutionCreditsData {
  solde_ecg: number;
  type: string;
  institution: { name: string } | null;
}

const CACHE_KEY = 'xecg-institution-credits';
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEnvelope = { ts: number; data: InstitutionCreditsData };

async function readCache(): Promise<CacheEnvelope | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed?.data || typeof parsed.ts !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(data: InstitutionCreditsData): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data } satisfies CacheEnvelope));
  } catch {
    /* best effort */
  }
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 0 || err.code === 'SERVER_UNREACHABLE' || err.code === 'REQUEST_TIMEOUT';
  }
  return false;
}

export const institutionCreditsAccessibilityLabel = {
  offline: 'Hors ligne — affichage du solde institutionnel mis en cache',
} as const;

/**
 * GET /credits/me (compte institutionnel actif uniquement).
 * Cache 5 min + repli hors ligne (audit #15).
 */
export function useInstitutionCredits(enabled: boolean) {
  const [credits, setCredits] = useState<InstitutionCreditsData | null>(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState<string | null>(null);
  const [fromCacheOnly, setFromCacheOnly] = useState(false);

  const institutionName = credits?.institution?.name ?? null;

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setCredits(null);
      setError(null);
      setFromCacheOnly(false);
      return;
    }

    setLoading(true);
    setError(null);
    setFromCacheOnly(false);

    try {
      const envelope = await readCache();
      if (envelope && Date.now() - envelope.ts < CACHE_TTL_MS) {
        setCredits(envelope.data);
      }

      const data = await api.get<InstitutionCreditsData>('/credits/me');
      const slim: InstitutionCreditsData = {
        solde_ecg: data.solde_ecg,
        type: data.type,
        institution: data.institution ? { name: data.institution.name } : null,
      };
      setCredits(slim);
      void writeCache(slim);
    } catch (e) {
      if (isNetworkFailure(e)) {
        const cached = await readCache();
        if (cached?.data) {
          setCredits(cached.data);
          setFromCacheOnly(true);
          setError(null);
        } else {
          setCredits(null);
          setError(getApiErrorMessage(e));
        }
      } else {
        setError(getApiErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    credits,
    institutionName,
    loading,
    error,
    refetch: load,
    fromCacheOnly,
    accessibilityLabelOffline: institutionCreditsAccessibilityLabel.offline,
  };
}
