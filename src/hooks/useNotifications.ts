/**
 * Hook pour récupérer les notifications in-app de l'utilisateur.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  ecg_record_id: string | null;
  created_at: string;
}

export function useNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await api.get<AppNotification[]>('/notifications');
      const list = Array.isArray(res) ? res : [];
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.read).length);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const markRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/mark-read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* non-blocking */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { notifications, loading, unreadCount, refetch: load, markRead, markAllRead };
}
