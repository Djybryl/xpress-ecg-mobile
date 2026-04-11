import type { Href } from 'expo-router';
import type { UserRole } from '@/types/user';

const HOME_BY_ROLE: Record<UserRole, string> = {
  medecin: '/(medecin)',
  cardiologue: '/(cardiologue)',
  secretaire: '/(secretaire)',
  admin: '/(admin)',
};

/** Route racine Expo Router du groupe correspondant au rôle (après connexion). */
export function homeRouteForRole(role: UserRole): Href {
  return HOME_BY_ROLE[role] as Href;
}
