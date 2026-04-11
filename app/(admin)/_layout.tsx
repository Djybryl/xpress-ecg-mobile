import { Stack } from 'expo-router';
import { useRoleGuard } from '@/hooks/useRoleGuard';

export default function AdminLayout() {
  const ok = useRoleGuard('admin');
  if (!ok) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
}
