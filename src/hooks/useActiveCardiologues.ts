import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/apiClient';
import type { UserListItem } from '@/hooks/useUsersList';

/** Cardiologues actifs (même établissement si défini) via GET /users/cardiologues/active */
export function useActiveCardiologues() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.get<UserListItem[]>('/users/cardiologues/active');
      setUsers(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  return { users, loading, error, refetch: fetchUsers };
}
