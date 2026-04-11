import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';

export type UserRole = 'medecin' | 'cardiologue' | 'secretaire' | 'admin';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface UserListItem {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  hospital_id: string | null;
  hospital_name?: string | null;
  created_at: string;
  prescriber_gate_status?: string | null;
}

export function useUsersList(params?: {
  role?: string;
  status?: string;
  limit?: number;
}) {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qp: Record<string, string | number> = { limit: params?.limit ?? 100 };
      if (params?.role) qp.role = params.role;
      if (params?.status) qp.status = params.status;
      const res = await api.get<{ users?: UserListItem[]; total?: number } | UserListItem[]>('/users', qp);
      const list = Array.isArray(res) ? res : ((res as { users?: UserListItem[] }).users ?? []);
      const tot = Array.isArray(res) ? list.length : ((res as { total?: number }).total ?? list.length);
      setUsers(list);
      setTotal(tot);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [params?.role, params?.status, params?.limit]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  return { users, total, loading, error, refetch: fetchUsers };
}
