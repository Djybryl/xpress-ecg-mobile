/**
 * Hook pour charger l'historique ECG d'un patient (ECG terminés, triés par date).
 * GET /ecg-records?patient_id=xxx&status=completed&limit=10
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import type { EcgRecordItem } from '@/hooks/useEcgList';
import { parseEcgListResponse } from '@/hooks/parseEcgListResponse';

export function usePatientEcgHistory(
  patientId: string | null | undefined,
  excludeRecordId?: string,
) {
  const [records, setRecords] = useState<EcgRecordItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await api.get<unknown>('/ecg-records', {
        patient_id: patientId,
        status: 'completed',
        limit: 10,
      });
      const { records: list } = parseEcgListResponse(res);
      setRecords(
        excludeRecordId
          ? list.filter(r => r.id !== excludeRecordId)
          : list,
      );
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, excludeRecordId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { records, loading, refetch: load };
}
