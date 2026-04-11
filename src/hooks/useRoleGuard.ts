import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import type { UserRole } from '@/types/user';

/**
 * Protège un groupe de routes : déconnecté → login ; mauvais rôle → hub `/`.
 * Retourne true lorsque le contenu protégé peut s'afficher.
 */
export function useRoleGuard(expected: UserRole): boolean {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (user.role !== expected) {
      router.replace('/');
    }
  }, [user, loading, expected, router]);

  if (loading) return false;
  if (!user || user.role !== expected) return false;
  return true;
}
