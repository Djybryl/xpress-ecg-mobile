import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export interface PrescriberPendingItem {
  id: string;
  email: string;
  full_name: string;
  prescriber_first_login_at: string | null;
  prescriber_gate_status: string | null;
  prescriber_documents_verified_at: string | null;
  dossierStatus: string;
  documentsCount: number;
}

export function usePendingPrescribers(enabled = true) {
  const [items, setItems] = useState<PrescriberPendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<PrescriberPendingItem[]>('/admin-prescribers/pending');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, error, refetch: load };
}
