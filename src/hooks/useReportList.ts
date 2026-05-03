import { useState, useEffect, useCallback, useRef } from 'react';
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

type CacheEntry = { data: ReportItem[]; ts: number; serverTotal: number; hasMore: boolean };

const reportCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function cacheKeyFromParams(params: UseReportListParams, limit: number): string {
  return JSON.stringify({
    referring_doctor_id: params.referring_doctor_id ?? null,
    is_read: params.is_read ?? null,
    limit,
  });
}

export function useReportList(params: UseReportListParams = {}) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(1);

  const fetchInternal = useCallback(
    async (opts: { append: boolean; bypassCache: boolean }) => {
      if (params.enabled === false) return;

      const limit = params.limit ?? 20;
      const ck = cacheKeyFromParams(params, limit);

      if (!opts.append) {
        if (!opts.bypassCache) {
          const cached = reportCache.get(ck);
          if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
            setReports(cached.data);
            setTotal(cached.serverTotal);
            setHasMore(cached.hasMore);
            pageRef.current = 1;
            setLoading(false);
            return;
          }
        }
        setLoading(true);
        pageRef.current = 1;
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const pageNum = opts.append ? pageRef.current + 1 : 1;
        const qp: Record<string, string | number | boolean | undefined> = {
          limit,
          page: pageNum,
        };
        if (params.referring_doctor_id) qp.referring_doctor_id = params.referring_doctor_id;
        if (params.is_read !== undefined) qp.is_read = params.is_read;

        const { items: list, meta } = await api.getList<ReportItem>('/reports', qp);
        const serverTotal = meta.total;

        if (opts.append) {
          let nextLen = 0;
          setReports(prev => {
            const next = [...prev, ...list];
            nextLen = next.length;
            return next;
          });
          setHasMore(nextLen < serverTotal);
          pageRef.current = pageNum;
          setTotal(serverTotal);
        } else {
          setReports(list);
          pageRef.current = 1;
          setTotal(serverTotal);
          const more = list.length < serverTotal;
          setHasMore(more);
          reportCache.set(ck, {
            data: list,
            ts: Date.now(),
            serverTotal,
            hasMore: more,
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [params.referring_doctor_id, params.is_read, params.limit, params.enabled],
  );

  useEffect(() => {
    void fetchInternal({ append: false, bypassCache: false });
  }, [fetchInternal]);

  const refetch = useCallback(() => {
    void fetchInternal({ append: false, bypassCache: true });
  }, [fetchInternal]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    void fetchInternal({ append: true, bypassCache: true });
  }, [hasMore, loading, loadingMore, fetchInternal]);

  const markRead = useCallback(async (id: string) => {
    await api.patch(`/reports/${id}/mark-read`);
    setReports(prev => prev.map(r => (r.id === id ? { ...r, is_read: true } : r)));
    reportCache.clear();
  }, []);

  const markAllRead = useCallback(async () => {
    const unreadIds = reports.filter(r => !r.is_read).map(r => r.id);
    if (unreadIds.length === 0) return;
    await Promise.all(unreadIds.map(id => api.patch(`/reports/${id}/mark-read`)));
    setReports(prev => prev.map(r => ({ ...r, is_read: true })));
    reportCache.clear();
  }, [reports]);

  const unreadCount = reports.filter(r => !r.is_read).length;
  const urgentUnreadCount = reports.filter(r => !r.is_read && r.is_urgent).length;

  return {
    reports,
    total,
    unreadCount,
    urgentUnreadCount,
    loading,
    loadingMore,
    hasMore,
    error,
    refetch,
    loadMore,
    markRead,
    markAllRead,
  };
}
