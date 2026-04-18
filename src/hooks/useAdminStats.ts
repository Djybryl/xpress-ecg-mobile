/**
 * Phase 4 — Statistiques admin seules (alias léger sur useAdminDashboard).
 * Les KPIs viennent de GET /dashboard/stats (rôle admin).
 */
import { useAdminDashboard } from '@/hooks/useAdminDashboard';

export function useAdminStats(enabled = true) {
  const { stats, loading, error, refetch } = useAdminDashboard(enabled);
  return { stats, loading, error, refetch };
}

export type { AdminStats } from '@/hooks/useAdminDashboard';
