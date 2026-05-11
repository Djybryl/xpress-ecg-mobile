import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, getApiErrorMessage } from '@/lib/apiClient';

export interface CrcWalletData {
  is_active: boolean;
  solde_fcfa: number;
}

const CACHE_KEY = 'xecg-crc-wallet';
const CACHE_TTL_MS = 2 * 60 * 1000;

type CacheEnvelope = { ts: number; data: CrcWalletData };

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

async function writeCache(data: CrcWalletData): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data } satisfies CacheEnvelope));
  } catch {
    /* ignore */
  }
}

async function clearCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

function isNoAccount(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || err.code === 'CRC_ACCOUNT_NOT_FOUND');
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 0 || err.code === 'SERVER_UNREACHABLE' || err.code === 'REQUEST_TIMEOUT';
  }
  return false;
}

export const crcAccountA11y = {
  offline: 'Hors ligne — solde CRC affiché depuis le cache',
} as const;

/**
 * GET /crc/wallet — 404 si pas de compte CRC.
 */
export function useCrcAccount(enabled: boolean) {
  const [wallet, setWallet] = useState<CrcWalletData | null | undefined>(undefined);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState<string | null>(null);
  const [fromCacheOnly, setFromCacheOnly] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setWallet(undefined);
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
        setWallet(envelope.data);
      }

      const data = await api.get<CrcWalletData>('/crc/wallet');
      setWallet(data);
      void writeCache(data);
    } catch (e) {
      if (isNoAccount(e)) {
        setWallet(null);
        void clearCache();
        setError(null);
      } else if (isNetworkFailure(e)) {
        const cached = await readCache();
        if (cached?.data) {
          setWallet(cached.data);
          setFromCacheOnly(true);
          setError(null);
        } else {
          setWallet(undefined);
          setError(getApiErrorMessage(e));
        }
      } else {
        setError(getApiErrorMessage(e));
        const cached = await readCache();
        if (cached?.data) {
          setWallet(cached.data);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasCrc = wallet !== null && wallet !== undefined;
  const resolved = wallet ?? null;

  return {
    /** Compte CRC existant (false si 404 ou pas encore chargé sans cache) */
    hasCrc,
    isActive: resolved?.is_active ?? false,
    solde: resolved?.solde_fcfa ?? 0,
    /** null = pas de compte ; undefined = chargement initial sans données */
    wallet: resolved,
    loading,
    error,
    refetch: load,
    fromCacheOnly,
    accessibilityLabelOffline: crcAccountA11y.offline,
  };
}
