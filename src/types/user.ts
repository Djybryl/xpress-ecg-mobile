export type UserRole = 'medecin' | 'cardiologue' | 'secretaire' | 'admin';

export type ActiveAccountType = 'individual' | 'institutional';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  /** @deprecated Préférer institutionId — conservé pour compat API */
  hospitalId?: string | null;
  institutionId?: string | null;
  institutionName?: string | null;
  activeAccountType?: ActiveAccountType;
  canSwitchToInstitutional?: boolean;
  prescriberFirstLoginAt?: string | null;
  prescriberGateStatus?: string | null;
  /** URL publique signature PDF (cardiologue) */
  signatureUrl?: string | null;
  specialty?: string | null;
  phone?: string | null;
  cnom?: string | null;
  pseudo?: string | null;
}

export interface BackendUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  hospitalId?: string | null;
  institutionId?: string | null;
  institutionName?: string | null;
  activeAccountType?: ActiveAccountType;
  canSwitchToInstitutional?: boolean;
  prescriberFirstLoginAt?: string | null;
  prescriberGateStatus?: string | null;
  signatureUrl?: string | null;
  signature_url?: string | null;
  specialty?: string | null;
  phone?: string | null;
  cnom?: string | null;
  pseudo?: string | null;
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
