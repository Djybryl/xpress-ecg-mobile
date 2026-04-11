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
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getApiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'QUOTA_EXCEEDED':
        return 'Quota mensuel atteint. Contactez votre administrateur.';
      case 'PRESCRIBER_GATE_BLOCKED':
        return 'Votre compte prescripteur n\'est pas encore validé.';
      case 'REQUEST_TIMEOUT':
        return 'Délai dépassé — le serveur met trop de temps à répondre.';
      case 'SERVER_UNREACHABLE':
        return 'Serveur non disponible — vérifiez votre connexion réseau.';
      case 'SESSION_EXPIRED':
        return 'Session expirée — veuillez vous reconnecter.';
      default: break;
    }
    switch (err.status) {
      case 0:   return 'Connexion impossible — vérifiez votre réseau.';
      case 403: return err.message || 'Accès refusé.';
      case 404: return 'Ressource introuvable.';
      case 413: return 'Le fichier est trop volumineux (max 100 Mo).';
      case 500: return 'Erreur serveur. Réessayez plus tard.';
      default:  return err.message || 'Une erreur inattendue s\'est produite.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Une erreur inattendue s\'est produite.';
}

export function getApiErrorAction(err: unknown): 'retry' | 'upgrade' | 'login' | null {
  if (!(err instanceof ApiError)) return 'retry';
  switch (err.code) {
    case 'QUOTA_EXCEEDED':
    case 'PRESCRIBER_GATE_BLOCKED':
      return 'upgrade';
    case 'SESSION_EXPIRED':
    case 'REFRESH_FAILED':
      return 'login';
    case 'SERVER_UNREACHABLE':
    case 'REQUEST_TIMEOUT':
      return 'retry';
    default:
      return err.status >= 500 ? 'retry' : null;
  }
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

const DEFAULT_TIMEOUT_MS = 30_000;

async function request<T>(
  method: string,
  path: string,
  options: {
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
    isRetry?: boolean;
    formData?: FormData;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const { body, params, isRetry = false, formData, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

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

  let res: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
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
      json.error?.details,
    );
  }
  return json.data as T;
}

// ─── Upload avec progression (XMLHttpRequest) ───────────────────────────────

const UPLOAD_TIMEOUT_MS = 120_000;

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  timeoutMs?: number;
}

async function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  options: UploadOptions = {},
): Promise<T> {
  const { onProgress, timeoutMs = UPLOAD_TIMEOUT_MS } = options;

  const token = await tokenStorage.getAccess();
  const url = `${BASE_URL}/api/v1${path}`;

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timer = setTimeout(() => {
      xhr.abort();
      reject(new ApiError(0, 'REQUEST_TIMEOUT', 'Délai dépassé — l\'envoi a pris trop de temps.'));
    }, timeoutMs);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      clearTimeout(timer);
      try {
        const json: ApiResponse<T> = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && json.success) {
          onProgress?.(100);
          resolve(json.data as T);
        } else {
          reject(new ApiError(
            xhr.status,
            json.error?.code ?? 'UNKNOWN_ERROR',
            json.error?.message ?? `Erreur ${xhr.status}`,
            json.error?.details,
          ));
        }
      } catch {
        reject(new ApiError(xhr.status, 'PARSE_ERROR', `Réponse invalide (${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      clearTimeout(timer);
      reject(new ApiError(0, 'SERVER_UNREACHABLE', 'Serveur non disponible — vérifiez votre connexion.'));
    };

    xhr.onabort = () => {
      clearTimeout(timer);
      reject(new ApiError(0, 'REQUEST_TIMEOUT', 'Envoi annulé.'));
    };

    xhr.open('POST', url);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

// ─── API publique ───────────────────────────────────────────────────────────

export const api = {
  get:    <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>('GET', path, { params }),
  post:   <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch:  <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  put:    <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, formData: FormData, options?: UploadOptions) =>
    uploadWithProgress<T>(path, formData, options),
};
