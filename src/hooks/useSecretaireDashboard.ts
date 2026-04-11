import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export interface SecretaireStats {
  pending_validation: number;
  assigned_today: number;
  total_today: number;
}

export function useSecretaireDashboard(enabled: boolean) {
  const [stats, setStats] = useState<SecretaireStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<SecretaireStats>('/dashboard/stats');
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, loading, error, refetch: load };
}
