import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import type { EcgRecordItem } from '@/hooks/useEcgList';
import { parseEcgListResponse } from '@/hooks/parseEcgListResponse';

export function useMyAssignedEcg(userId: string | undefined, limit = 50) {
  const [records, setRecords] = useState<EcgRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<unknown>('/ecg-records', {
        assigned_to: userId,
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
  }, [userId, limit]);

  useEffect(() => { void fetchRecords(); }, [fetchRecords]);

  const pendingCount = records.filter(
    r => r.status === 'pending' || r.status === 'assigned',
  ).length;

  return { records, total, pendingCount, loading, error, refetch: fetchRecords };
}
