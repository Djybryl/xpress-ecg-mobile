import type { ReactNode } from 'react';
import type { UserRole } from '@/types/user';
import { useRoleGuard } from '@/hooks/useRoleGuard';

export function RoleGuard({ role, children }: { role: UserRole; children: ReactNode }) {
  const ok = useRoleGuard(role);
  if (!ok) return null;
  return <>{children}</>;
}
