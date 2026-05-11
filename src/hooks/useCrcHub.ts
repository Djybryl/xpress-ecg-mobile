import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, getApiErrorMessage } from '@/lib/apiClient';
import type { PrescripteurItem } from './useCrcPrescripteursTypes';

export interface CrcStatsPayload {
  totalEcg: number;
  totalFrais: number;
  avgDelaiMin: number;
  period: string;
  report_pdf_signed_url: string;
}

const CACHE_KEY = 'xecg-crc-hub';
const CACHE_TTL_MS = 3 * 60 * 1000;

export type CrcHubCache = {
  queueCount: number;
  prescribers: PrescripteurItem[];
  stats: CrcStatsPayload | null;
  ts: number;
};

async function readFull(): Promise<CrcHubCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as CrcHubCache;
    if (typeof o.ts !== 'number' || !Array.isArray(o.prescribers)) return null;
    return o;
  } catch {
    return null;
  }
}

async function writeFull(data: Omit<CrcHubCache, 'ts'>): Promise<void> {
  try {
    const env: CrcHubCache = { ...data, ts: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(env));
  } catch {
    /* ignore */
  }
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 0 || err.code === 'SERVER_UNREACHABLE' || err.code === 'REQUEST_TIMEOUT';
  }
  return false;
}

function periodYm(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function useCrcHub(enabled: boolean) {
  const [queueCount, setQueueCount] = useState(0);
  const [prescribers, setPrescribers] = useState<PrescripteurItem[]>([]);
  const [stats, setStats] = useState<CrcStatsPayload | null>(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error, setError] = useState<string | null>(null);
  const [fromCacheOnly, setFromCacheOnly] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setQueueCount(0);
      setPrescribers([]);
      setStats(null);
      setError(null);
      setFromCacheOnly(false);
      return;
    }

    setLoading(true);
    setError(null);
    setFromCacheOnly(false);
    const p = periodYm();

    try {
      const envelope = await readFull();
      if (envelope && Date.now() - envelope.ts < CACHE_TTL_MS) {
        setQueueCount(envelope.queueCount);
        setPrescribers(envelope.prescribers);
        setStats(envelope.stats);
      }

      const [queue, presc, st] = await Promise.all([
        api.get<unknown[]>('/crc/ecg-queue', { status: 'pending', limit: 50 }),
        api.get<PrescripteurItem[]>('/crc/prescripteurs'),
        api.get<CrcStatsPayload>('/crc/stats', { period: p }),
      ]);

      const qCount = Array.isArray(queue) ? queue.length : 0;
      setQueueCount(qCount);
      setPrescribers(presc ?? []);
      setStats(st);
      void writeFull({ queueCount: qCount, prescribers: presc ?? [], stats: st });
    } catch (e) {
      if (isNetworkFailure(e)) {
        const cached = await readFull();
        if (cached) {
          setQueueCount(cached.queueCount);
          setPrescribers(cached.prescribers);
          setStats(cached.stats);
          setFromCacheOnly(true);
          setError(null);
        } else {
          setError(getApiErrorMessage(e));
        }
      } else {
        setError(getApiErrorMessage(e));
        const cached = await readFull();
        if (cached) {
          setQueueCount(cached.queueCount);
          setPrescribers(cached.prescribers);
          setStats(cached.stats);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    queueCount,
    prescribersCount: prescribers.length,
    prescribers,
    stats,
    loading,
    error,
    refetch: load,
    fromCacheOnly,
    accessibilityLabelOffline: 'Hors ligne — données du hub CRC en cache',
  };
}
