/**
 * Client HTTP Xpress-ECG — version mobile React Native.
 * Stockage des tokens via expo-secure-store (Keychain natif) au lieu de localStorage/sessionStorage.
 */
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

const TOKEN_KEY = 'xecg-access-token';
const REFRESH_KEY = 'xecg-refresh-token';

// ─── Gestion des tokens (SecureStore natif) ────────────────────────────────

export const tokenStorage = {
  getAccess: async (): Promise<string | null> => {
    try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
  },
  getRefresh: async (): Promise<string | null> => {
    try { return await SecureStore.getItemAsync(REFRESH_KEY); } catch { return null; }
  },
  save: async (accessToken: string, refreshToken: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => null);
    await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => null);
  },
};

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getApiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 0:   return 'Serveur injoignable. Vérifiez votre connexion réseau.';
      case 403: return err.message || 'Accès refusé.';
      case 404: return 'Ressource introuvable.';
      case 500: return 'Erreur serveur. Réessayez plus tard.';
      default:  return err.message || 'Une erreur inattendue s\'est produite.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Une erreur inattendue s\'est produite.';
}

// ─── Listeners session expirée ──────────────────────────────────────────────

type SessionExpiredHandler = () => void;
const sessionExpiredListeners: SessionExpiredHandler[] = [];

export function onSessionExpired(handler: SessionExpiredHandler) {
  sessionExpiredListeners.push(handler);
  return () => {
    const i = sessionExpiredListeners.indexOf(handler);
    if (i >= 0) sessionExpiredListeners.splice(i, 1);
  };
}

function notifySessionExpired() {
  sessionExpiredListeners.forEach(h => h());
}

// ─── Refresh ────────────────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = await tokenStorage.getRefresh();
    if (!refreshToken) throw new ApiError(401, 'NO_REFRESH_TOKEN', 'Session expirée');

    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json: ApiResponse<{ tokens: { accessToken: string; refreshToken: string } }> = await res.json();

    if (!res.ok || !json.success || !json.data?.tokens?.accessToken) {
      await tokenStorage.clear();
      throw new ApiError(401, 'REFRESH_FAILED', 'Session expirée — veuillez vous reconnecter');
    }
    await tokenStorage.save(json.data.tokens.accessToken, json.data.tokens.refreshToken);
    return json.data.tokens.accessToken;
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

// ─── Requête principale ─────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  options: {
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
    isRetry?: boolean;
    formData?: FormData;
  } = {},
): Promise<T> {
  const { body, params, isRetry = false, formData } = options;

  const url = new URL(`${BASE_URL}/api/v1${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }

  const headers: Record<string, string> = {};
  const token = await tokenStorage.getAccess();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!formData && ['POST', 'PUT', 'PATCH'].includes(method)) {
    headers['Content-Type'] = 'application/json';
  }

  const REQUEST_TIMEOUT_MS = 30_000;
  let res: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    res = await fetch(url.toString(), {
      method,
      headers,
      body: formData ?? (body ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, 'REQUEST_TIMEOUT', 'Délai dépassé — le serveur met trop de temps à répondre.');
    }
    throw new ApiError(0, 'SERVER_UNREACHABLE', 'Serveur non disponible — vérifiez votre connexion.');
  }

  if (res.status === 401 && !isRetry) {
    try {
      await refreshAccessToken();
      return request<T>(method, path, { ...options, isRetry: true });
    } catch {
      await tokenStorage.clear();
      notifySessionExpired();
      throw new ApiError(401, 'SESSION_EXPIRED', 'Session expirée — veuillez vous reconnecter');
    }
  }

  let json: ApiResponse<T>;
  try { json = await res.json(); }
  catch { throw new ApiError(res.status, 'PARSE_ERROR', `Réponse invalide du serveur (${res.status})`); }

  if (!res.ok || !json.success) {
    throw new ApiError(
      res.status,
      json.error?.code ?? 'UNKNOWN_ERROR',
      json.error?.message ?? `Erreur ${res.status}`,
    );
  }
  return json.data as T;
}

// ─── API publique ───────────────────────────────────────────────────────────

export const api = {
  get:    <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>('GET', path, { params }),
  post:   <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch:  <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  put:    <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, formData: FormData) => request<T>('POST', path, { formData }),
};
