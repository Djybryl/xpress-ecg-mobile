import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export interface AdminStats {
  total_users: number;
  total_hospitals: number;
  total_ecg_today: number;
  total_ecg_month: number;
  pending_ecg: number;
  completed_ecg: number;
}

/** Aligné sur GET /dashboard/activity-logs (voir dashboard.service — champ date principal : created_at) */
export interface ActivityLogItem {
  id: string;
  action: string;
  referring_doctor_id?: string | null;
  assigned_to?: string | null;
  user_id?: string;
  ecg_record_id?: string | null;
  details?: string;
  created_at: string;
  updated_at?: string;
}

export function useAdminDashboard(enabled = true) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const statsData = await api.get<AdminStats>('/dashboard/stats');
      setStats(statsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur statistiques');
      setStats(null);
    }
    try {
      const logsRes = await api.get<{ logs?: ActivityLogItem[] } | ActivityLogItem[]>(
        '/dashboard/activity-logs',
        { limit: 15 },
      );
      const logList = Array.isArray(logsRes)
        ? logsRes
        : ((logsRes as { logs?: ActivityLogItem[] }).logs ?? []);
      setLogs(logList);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, logs, loading, error, refetch: load };
}
