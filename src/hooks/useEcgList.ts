import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export interface EcgRecordItem {
  id: string;
  reference: string;
  patient_name: string;
  patient_id: string | null;
  patient_age?: number | null;
  medical_center: string;
  gender: 'M' | 'F' | null;
  referring_doctor_id: string | null;
  assigned_to: string | null;
  /** pending (+ assigned_to) → analyzing → completed ; validated/assigned = enum legacy */
  status: 'pending' | 'assigned' | 'analyzing' | 'completed' | 'validated';
  urgency: 'normal' | 'urgent';
  clinical_context: string | null;
  date: string;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseEcgListParams {
  referring_doctor_id?: string;
  status?: string;
  limit?: number;
  enabled?: boolean;
}

export function useEcgList(params: UseEcgListParams = {}) {
  const [records, setRecords] = useState<EcgRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  // Démarre en loading=true si la requête sera lancée, évite le flash "Aucune demande"
  const [loading, setLoading] = useState(params.enabled !== false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (params.enabled === false) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qp: Record<string, string | number | boolean | undefined> = {
        limit: params.limit ?? 100,
      };
      if (params.referring_doctor_id) qp.referring_doctor_id = params.referring_doctor_id;
      if (params.status) qp.status = params.status;

      const res = await api.get<{ records?: EcgRecordItem[]; total?: number } | EcgRecordItem[]>(
        '/ecg-records', qp,
      );
      const list = Array.isArray(res) ? res : ((res as { records?: EcgRecordItem[] }).records ?? []);
      const tot = Array.isArray(res) ? list.length : ((res as { total?: number }).total ?? list.length);
      setRecords(list);
      setTotal(tot);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [params.referring_doctor_id, params.status, params.limit, params.enabled]);

  useEffect(() => { void fetchRecords(); }, [fetchRecords]);

  return { records, total, loading, error, refetch: fetchRecords };
}
