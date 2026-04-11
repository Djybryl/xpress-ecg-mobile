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

export interface ActivityLogItem {
  id: string;
  action: string;
  referring_doctor_id: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
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
      const [statsData, logsRes] = await Promise.all([
        api.get<AdminStats>('/dashboard/stats'),
        api.get<{ logs?: ActivityLogItem[] } | ActivityLogItem[]>('/dashboard/activity-logs', { limit: 15 }),
      ]);
      setStats(statsData);
      const logList = Array.isArray(logsRes)
        ? logsRes
        : ((logsRes as { logs?: ActivityLogItem[] }).logs ?? []);
      setLogs(logList);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, logs, loading, error, refetch: load };
}
