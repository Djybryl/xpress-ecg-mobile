import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, getApiErrorMessage } from '@/lib/apiClient';

export interface CardiologistRatioRow {
  id: string;
  cardiologist_id: string;
  period_start: string;
  period_end: string;
  ecg_free_count: number;
  ecg_premium_count: number;
  ratio_status: 'OK' | 'ALERT' | 'SUSPENDED';
  is_grace_period: boolean | null;
  last_calculated_at: string | null;
}

export interface CardiologistRatiosPayload {
  latest: CardiologistRatioRow | null;
  history: CardiologistRatioRow[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEnvelope<T> = { ts: number; data: T };

function ratiosCacheKey(cardiologistId: string): string {
  return `xecg-cardio-ratios-${cardiologistId}`;
}

async function readRatiosCacheEnvelope(
  cardiologistId: string,
): Promise<CacheEnvelope<CardiologistRatiosPayload> | null> {
  try {
    const raw = await AsyncStorage.getItem(ratiosCacheKey(cardiologistId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<CardiologistRatiosPayload>;
    if (!parsed || typeof parsed.ts !== 'number' || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeRatiosCache(cardiologistId: string, data: CardiologistRatiosPayload): Promise<void> {
  try {
    const env: CacheEnvelope<CardiologistRatiosPayload> = { ts: Date.now(), data };
    await AsyncStorage.setItem(ratiosCacheKey(cardiologistId), JSON.stringify(env));
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

export const cardiologistRatiosAccessibilityLabel = {
  loading: 'Chargement des ratios Give et Get',
  error: 'Erreur lors du chargement des ratios cardiologue',
  offline: 'Hors ligne — affichage des derniers ratios en cache',
} as const;

export function useCardiologistRatios(cardiologistId: string | undefined) {
  const [data, setData] = useState<CardiologistRatiosPayload | null>(null);
  const [loading, setLoading] = useState(!!cardiologistId);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cardiologistId) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const envelope = await readRatiosCacheEnvelope(cardiologistId);
      if (envelope && Date.now() - envelope.ts < CACHE_TTL_MS) {
        setData(envelope.data);
      }

      const d = await api.get<CardiologistRatiosPayload>(
        `/economy/cardiologists/${cardiologistId}/ratios`,
      );
      setData(d);
      void writeRatiosCache(cardiologistId, d);
    } catch (e) {
      try {
        if (isNetworkFailure(e)) {
          const cached = await readRatiosCacheEnvelope(cardiologistId);
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
  }, [cardiologistId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    loading,
    error,
    refetch: load,
    accessibilityLabelLoading: cardiologistRatiosAccessibilityLabel.loading,
    accessibilityLabelError: cardiologistRatiosAccessibilityLabel.error,
    accessibilityLabelOffline: cardiologistRatiosAccessibilityLabel.offline,
  };
}
