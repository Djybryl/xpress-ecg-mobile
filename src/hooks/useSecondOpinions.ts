import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export interface SecondOpinionItem {
  id: string;
  ecg_record_id: string;
  requesting_doctor_id: string;
  consultant_id: string;
  notes: string | null;
  response: string | null;
  status: 'pending' | 'accepted' | 'refused' | 'completed';
  created_at: string;
  updated_at: string;
}

export function useSecondOpinions(params?: {
  status?: string;
  ecg_record_id?: string;
  enabled?: boolean;
}) {
  const [items, setItems] = useState<SecondOpinionItem[]>([]);
  const [loading, setLoading] = useState(params?.enabled !== false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (params?.enabled === false) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qp: Record<string, string | number | boolean | undefined> = {};
      if (params?.status) qp.status = params.status;
      if (params?.ecg_record_id) qp.ecg_record_id = params.ecg_record_id;
      const res = await api.get<SecondOpinionItem[]>('/second-opinions', qp);
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [params?.status, params?.ecg_record_id, params?.enabled]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  return { items, loading, error, refetch: fetchList };
}

export async function fetchSecondOpinionById(id: string): Promise<SecondOpinionItem> {
  return api.get<SecondOpinionItem>(`/second-opinions/${id}`);
}
