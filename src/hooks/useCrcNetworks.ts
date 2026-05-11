import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, getApiErrorMessage } from '@/lib/apiClient';

export interface CrcNetworkItem {
  id: string;
  crc_id: string;
  cardiologue_pseudo: string | null;
  cardiologue_name: string;
  status: 'pending' | 'active';
  invited_at: string;
  joined_at: string | null;
}

export interface CrcNetworksPayload {
  hasCrc: boolean;
  networks: CrcNetworkItem[];
}

const CACHE_KEY = 'xecg-crc-networks';
const CACHE_TTL_MS = 5 * 60 * 1000;

type Envelope = { ts: number; data: CrcNetworksPayload };

async function readCache(): Promise<Envelope | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope;
    if (!parsed?.data || typeof parsed.ts !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(data: CrcNetworksPayload): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data } satisfies Envelope));
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

export function useCrcNetworks(enabled: boolean) {
  const [hasCrc, setHasCrc] = useState(false);
  const [networks, setNetworks] = useState<CrcNetworkItem[]>([]);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState<string | null>(null);
  const [fromCacheOnly, setFromCacheOnly] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setHasCrc(false);
      setNetworks([]);
      setLoading(false);
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
        setHasCrc(envelope.data.hasCrc);
        setNetworks(envelope.data.networks);
      }

      const payload = await api.get<CrcNetworksPayload>('/crc/info');
      setHasCrc(payload.hasCrc);
      setNetworks(payload.networks ?? []);
      void writeCache({
        hasCrc: payload.hasCrc,
        networks: payload.networks ?? [],
      });
    } catch (e) {
      if (isNetworkFailure(e)) {
        const cached = await readCache();
        if (cached?.data) {
          setHasCrc(cached.data.hasCrc);
          setNetworks(cached.data.networks);
          setFromCacheOnly(true);
          setError(null);
        } else {
          setHasCrc(false);
          setNetworks([]);
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

  const pendingInvites = networks.filter((n) => n.status === 'pending');

  return {
    hasCrc,
    networks,
    pendingInvites,
    loading,
    error,
    refetch: load,
    fromCacheOnly,
    accessibilityLabelOffline: 'Hors ligne — réseaux CRC affichés depuis le cache',
  };
}
