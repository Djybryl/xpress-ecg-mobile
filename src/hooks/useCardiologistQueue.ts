import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import type { EcgRecordItem } from '@/hooks/useEcgList';
import { parseEcgListResponse } from '@/hooks/parseEcgListResponse';

/**
 * File ECG côté cardiologue : GET /ecg-records avec viewer_id (tous les non terminés + mes analyses).
 */
export function useCardiologistQueue(viewerId: string | undefined, limit = 100) {
  const [records, setRecords] = useState<EcgRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!viewerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<unknown>('/ecg-records', {
        viewer_id: viewerId,
        include_analyzing: true,
        limit,
      });
      const { records: list, total: tot } = parseEcgListResponse(res);
      setRecords(list);
      setTotal(tot);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [viewerId, limit]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  return { records, total, loading, error, refetch: fetchRecords };
}
