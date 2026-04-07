import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export interface PatientItem {
  id: string;
  name: string;
  patient_id: string | null;
  reference?: string | null;
  date_of_birth: string | null;
  gender: 'M' | 'F' | null;
  phone?: string | null;
  email?: string | null;
  ecg_count?: number;
}

export function usePatientList(params: { limit?: number; enabled?: boolean } = {}) {
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (params.enabled === false) return;
    setLoading(true);
    try {
      const res = await api.get<PatientItem[] | { patients?: PatientItem[] }>(
        '/patients', { limit: params.limit ?? 200 },
      );
      setPatients(Array.isArray(res) ? res : ((res as { patients?: PatientItem[] }).patients ?? []));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [params.limit, params.enabled]);

  useEffect(() => { void fetch(); }, [fetch]);

  return { patients, loading, refetch: fetch };
}
