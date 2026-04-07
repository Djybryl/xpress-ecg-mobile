export type UserRole = 'medecin' | 'cardiologue' | 'secretaire' | 'admin';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  hospitalId?: string | null;
  prescriberFirstLoginAt?: string | null;
  prescriberGateStatus?: string | null;
}

export interface BackendUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  hospitalId: string | null;
  prescriberFirstLoginAt?: string | null;
  prescriberGateStatus?: string | null;
}

export interface BackendTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: BackendUser;
  tokens: BackendTokens;
}

const ROLE_MAP: Record<string, UserRole> = {
  doctor: 'medecin', expert: 'cardiologue', secretary: 'secretaire',
  medecin: 'medecin', cardiologue: 'cardiologue', secretaire: 'secretaire', admin: 'admin',
};

export function normalizeApiRole(role: string | undefined | null): UserRole {
  if (!role) return 'medecin';
  return ROLE_MAP[role.toLowerCase()] ?? 'medecin';
}
