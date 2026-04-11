import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

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

export function useCardiologistRatios(cardiologistId: string | undefined) {
  const [data, setData] = useState<CardiologistRatiosPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cardiologistId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api.get<CardiologistRatiosPayload>(
        `/economy/cardiologists/${cardiologistId}/ratios`,
      );
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [cardiologistId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
