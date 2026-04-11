import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import type { EcgRecordItem } from '@/hooks/useEcgList';

export interface EcgFileSummary {
  id: string;
  filename: string;
  file_url?: string;
  file_type: string;
}

export type EcgRecordDetail = EcgRecordItem & {
  hospital_id?: string | null;
  notes: string | null;
  heart_rate: number | null;
  analyzed: boolean;
  analyzed_at: string | null;
  files: EcgFileSummary[];
};

export function useEcgRecordDetail(id: string | undefined) {
  const [record, setRecord] = useState<EcgRecordDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<EcgRecordDetail>(`/ecg-records/${id}`);
      setRecord(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { record, loading, error, refetch: load };
}
