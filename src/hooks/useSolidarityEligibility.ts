import { useState, useEffect, useCallback } from 'react';
import { api, getApiErrorMessage } from '@/lib/apiClient';

export interface SolidarityEligibilityPayload {
  eligible: boolean;
  done: number;
  required: number;
  freeCompleted: number;
  urgentCompleted: number;
  windowStartIso: string;
  windowEndIso: string;
  reasonCode?: string;
}

/**
 * Seuil solidarité 7 j (lecture) — GET /economy/cardiologists/:id/solidarity-eligibility
 */
export function useSolidarityEligibility(cardiologistId: string | undefined) {
  const [data, setData] = useState<SolidarityEligibilityPayload | null>(null);
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
      const d = await api.get<SolidarityEligibilityPayload>(
        `/economy/cardiologists/${cardiologistId}/solidarity-eligibility`,
      );
      setData(d);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [cardiologistId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
