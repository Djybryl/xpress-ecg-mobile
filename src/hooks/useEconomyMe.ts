import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, getApiErrorMessage } from '@/lib/apiClient';

export interface EconomyGate {
  allowed: boolean;
  remaining?: number;
  mode: 'subscription' | 'user_quota' | 'premium_unmetered' | 'no_limit';
  reason?: string;
  code?: string;
}

export interface EconomyQuota {
  ecg_used: number;
  ecg_limit: number;
}

export interface EconomySubscription {
  plan: string;
  status: string;
  monthly_ecg_quota: number;
  ecg_used_this_month: number;
}

export interface EconomyData {
  monthYear: string;
  /** Établissement rattaché (profil utilisateur) */
  hospitalId: string | null;
  accessLevel: 'GRATUIT' | 'PREMIUM';
  gate: EconomyGate;
  quota: EconomyQuota | null;
  subscription: EconomySubscription | null;
}

const CACHE_KEY = 'xecg-economy-me-cache';
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEnvelope<T> = { ts: number; data: T };

async function readEconomyCacheEnvelope(): Promise<CacheEnvelope<EconomyData> | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<EconomyData>;
    if (!parsed || typeof parsed.ts !== 'number' || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeEconomyCache(data: EconomyData): Promise<void> {
  try {
    const env: CacheEnvelope<EconomyData> = { ts: Date.now(), data };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(env));
  } catch {
    /* best effort — même pattern que useInterpretDraft */
  }
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 0 || err.code === 'SERVER_UNREACHABLE' || err.code === 'REQUEST_TIMEOUT';
  }
  return false;
}

/** Labels A11y (audit #14) — à appliquer sur ActivityIndicator / annonces d’état */
export const economyMeAccessibilityLabel = {
  loading: 'Chargement du quota et de l\'abonnement',
  error: 'Erreur lors du chargement des données économiques',
  offline: 'Hors ligne — affichage des dernières données économiques en cache',
} as const;

export function useEconomyMe(enabled = true) {
  const [data, setData] = useState<EconomyData | null>(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const envelope = await readEconomyCacheEnvelope();
      if (envelope && Date.now() - envelope.ts < CACHE_TTL_MS) {
        setData(envelope.data);
      }

      const d = await api.get<EconomyData>('/economy/me');
      setData(d);
      void writeEconomyCache(d);
    } catch (e) {
      try {
        if (isNetworkFailure(e)) {
          const cached = await readEconomyCacheEnvelope();
          if (cached?.data) {
            setData(cached.data);
          } else {
            setData(null);
          }
          setError('offline');
        } else {
          setError(getApiErrorMessage(e));
        }
      } catch {
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
    accessibilityLabelLoading: economyMeAccessibilityLabel.loading,
    accessibilityLabelError: economyMeAccessibilityLabel.error,
    accessibilityLabelOffline: economyMeAccessibilityLabel.offline,
  };
}
