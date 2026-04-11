import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import type { EcgRecordItem } from '@/hooks/useEcgList';
import { parseEcgListResponse } from '@/hooks/parseEcgListResponse';

/**
 * File ECG pour la secrétaire : ECG en attente de validation (status pending)
 * et, optionnellement, tous les ECG du jour.
 */
export function useEcgValidationQueue(status?: string, limit = 150) {
  const [records, setRecords] = useState<EcgRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | boolean> = { limit };
      if (status) params.status = status;
      const res = await api.get<unknown>('/ecg-records', params);
      const { records: list, total: tot } = parseEcgListResponse(res);
      setRecords(list);
      setTotal(tot);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [status, limit]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  return { records, total, loading, error, refetch: fetchRecords };
}
