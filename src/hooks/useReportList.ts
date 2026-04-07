import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export interface ReportItem {
  id: string;
  ecg_record_id: string;
  cardiologist_id: string;
  conclusion: string;
  is_normal: boolean;
  is_read: boolean;
  is_urgent: boolean;
  status: 'draft' | 'validated' | 'sent';
  pdf_url: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  patient_name: string | null;
  patient_id?: string | null;
  cardiologist_name: string | null;
  ecg_reference: string | null;
}

export interface UseReportListParams {
  referring_doctor_id?: string;
  is_read?: boolean;
  limit?: number;
  enabled?: boolean;
}

export function useReportList(params: UseReportListParams = {}) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (params.enabled === false) return;
    setLoading(true);
    setError(null);
    try {
      const qp: Record<string, string | number | boolean | undefined> = {
        limit: params.limit ?? 100,
      };
      if (params.referring_doctor_id) qp.referring_doctor_id = params.referring_doctor_id;
      if (params.is_read !== undefined) qp.is_read = params.is_read;

      const res = await api.get<ReportItem[] | { reports?: ReportItem[]; total?: number }>('/reports', qp);
      const list = Array.isArray(res) ? res : ((res as { reports?: ReportItem[] }).reports ?? []);
      const tot = Array.isArray(res) ? list.length : ((res as { total?: number }).total ?? list.length);
      setReports(list);
      setTotal(tot);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [params.referring_doctor_id, params.is_read, params.limit, params.enabled]);

  useEffect(() => { void fetchReports(); }, [fetchReports]);

  const markRead = useCallback(async (id: string) => {
    await api.patch(`/reports/${id}/read`);
    setReports(prev => prev.map(r => r.id === id ? { ...r, is_read: true } : r));
  }, []);

  const markAllRead = useCallback(async () => {
    await api.post('/reports/mark-all-read');
    setReports(prev => prev.map(r => ({ ...r, is_read: true })));
  }, []);

  const unreadCount = reports.filter(r => !r.is_read).length;
  const urgentUnreadCount = reports.filter(r => !r.is_read && r.is_urgent).length;

  return { reports, total, unreadCount, urgentUnreadCount, loading, error, refetch: fetchReports, markRead, markAllRead };
}
