import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export interface CardiologueDashboardStats {
  assigned_count: number;
  analyzing_count: number;
  completed_today: number;
  pending_second_opinions: number;
  demandes_count: number;
  urgent_count: number;
}

export function useCardiologistDashboard(enabled: boolean) {
  const [stats, setStats] = useState<CardiologueDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<CardiologueDashboardStats>('/dashboard/stats');
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
