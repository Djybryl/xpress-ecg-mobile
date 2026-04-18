import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { api, tokenStorage, onSessionExpired, AUTH_REQUEST_TIMEOUT_MS } from '@/lib/apiClient';
import type { UserSession, LoginResponse } from '@/types/user';
import { normalizeApiRole } from '@/types/user';

const SESSION_KEY = 'xecg-user-session';

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserSession>;
  loginWithBiometrics: () => Promise<UserSession | null>;
  logout: () => Promise<void>;
  isBiometricAvailable: boolean;
  isBiometricEnrolled: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toUserSession(data: LoginResponse): UserSession {
  return {
    id: data.user.id,
    email: data.user.email,
    name: data.user.fullName,
    role: normalizeApiRole(data.user.role),
    hospitalId: data.user.hospitalId,
    prescriberFirstLoginAt: data.user.prescriberFirstLoginAt ?? null,
    prescriberGateStatus: data.user.prescriberGateStatus ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);

  // Vérification disponibilité biométrie
  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then((has: boolean) => setIsBiometricAvailable(has));
    LocalAuthentication.isEnrolledAsync().then((enrolled: boolean) => setIsBiometricEnrolled(enrolled));
  }, []);

  // Restauration session — toujours terminer loading (evite ecran indigo infini avec Strict Mode / SecureStore lent)
  useEffect(() => {
    const backup = setTimeout(() => setLoading(false), 4000);

    const restore = async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (!raw) return;
        const stored: UserSession = JSON.parse(raw);
        const token = await tokenStorage.getAccess();
        if (!token) {
          await SecureStore.deleteItemAsync(SESSION_KEY);
          return;
        }
        setUser(stored);
        api.get<{ user: LoginResponse['user'] }>('/auth/me', undefined, { timeoutMs: AUTH_REQUEST_TIMEOUT_MS })
          .then(me => {
            setUser(prev => prev ? {
              ...prev,
              name: me.user.fullName,
              role: normalizeApiRole(me.user.role),
              hospitalId: me.user.hospitalId ?? prev.hospitalId,
              prescriberGateStatus: me.user.prescriberGateStatus ?? prev.prescriberGateStatus,
            } : prev);
          })
          .catch(() => null);
      } catch {
        // session corrompue
      } finally {
        clearTimeout(backup);
        setLoading(false);
      }
    };

    void restore();
    return () => clearTimeout(backup);
  }, []);

  // Écoute expiration de session
  useEffect(() => {
    return onSessionExpired(async () => {
      await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => null);
      await tokenStorage.clear();
      setUser(null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<LoginResponse>(
      '/auth/login',
      { email, password },
      { timeoutMs: AUTH_REQUEST_TIMEOUT_MS },
    );
    await tokenStorage.save(data.tokens.accessToken, data.tokens.refreshToken);
    const session = toUserSession(data);
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  }, []);

  const loginWithBiometrics = useCallback(async (): Promise<UserSession | null> => {
    if (!isBiometricAvailable || !isBiometricEnrolled) return null;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Identifiez-vous pour accéder à Xpress ECG',
      cancelLabel: 'Annuler',
      fallbackLabel: 'Mot de passe',
    });
    if (!result.success) return null;
    const token = await tokenStorage.getAccess();
    if (!token) return null;
    try {
      const me = await api.get<{ user: LoginResponse['user'] }>(
        '/auth/me',
        undefined,
        { timeoutMs: AUTH_REQUEST_TIMEOUT_MS },
      );
      const session: UserSession = {
        id: me.user.id, email: me.user.email, name: me.user.fullName,
        role: normalizeApiRole(me.user.role), hospitalId: me.user.hospitalId,
        prescriberFirstLoginAt: me.user.prescriberFirstLoginAt ?? null,
        prescriberGateStatus: me.user.prescriberGateStatus ?? null,
      };
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
      setUser(session);
      return session;
    } catch {
      return null;
    }
  }, [isBiometricAvailable, isBiometricEnrolled]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    await tokenStorage.clear();
    await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, login, loginWithBiometrics, logout,
      isBiometricAvailable, isBiometricEnrolled,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
