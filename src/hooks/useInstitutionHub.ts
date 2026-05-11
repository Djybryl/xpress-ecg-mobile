import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, getApiErrorMessage } from '@/lib/apiClient';

export interface CreditHistoryRow {
  id: string;
  status: string;
  type: string;
  nb_paquets: number;
  montant_total: number;
  created_at: string;
  updated_at: string;
}

export interface InstitutionHubData {
  solde_ecg: number;
  type: string;
  history: CreditHistoryRow[];
  institution: {
    name: string;
    responsable_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
  } | null;
}

const CACHE_KEY = 'xecg-institution-hub';
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEnvelope = { ts: number; data: InstitutionHubData };

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

async function writeCache(data: InstitutionHubData): Promise<void> {
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

export const institutionHubAccessibilityLabel = {
  offline: 'Hors ligne — données institution affichées depuis le cache',
} as const;

/**
 * GET /credits/me (complet : historique) — hub institution mobile.
 */
export function useInstitutionHub(enabled: boolean) {
  const [data, setData] = useState<InstitutionHubData | null>(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState<string | null>(null);
  const [fromCacheOnly, setFromCacheOnly] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setData(null);
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
        setData(envelope.data);
      }

      const raw = await api.get<InstitutionHubData>('/credits/me');
      setData(raw);
      void writeCache(raw);
    } catch (e) {
      if (isNetworkFailure(e)) {
        const cached = await readCache();
        if (cached?.data) {
          setData(cached.data);
          setFromCacheOnly(true);
          setError(null);
        } else {
          setData(null);
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
    data,
    loading,
    error,
    refetch: load,
    fromCacheOnly,
    accessibilityLabelOffline: institutionHubAccessibilityLabel.offline,
  };
}
