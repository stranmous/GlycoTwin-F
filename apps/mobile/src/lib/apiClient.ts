import { env } from './env';
import { useAuthStore } from './authStore';

type Json = Record<string, unknown> | unknown[];

class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function normalizePath(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/api/v1')) return path;
  if (path.startsWith('/v1/meals')) return path.replace('/v1/meals', '/api/v1/ingestion/history/meals');
  if (path === '/v1/me/profile' || path.startsWith('/v1/me/profile/') || path.startsWith('/v1/me/profile?')) {
    return path.replace('/v1/me/profile', '/api/v1/auth/profile');
  }
  if (path === '/v1/me' || path.startsWith('/v1/me/') || path.startsWith('/v1/me?')) {
    return path.replace('/v1/me', '/api/v1/auth/me');
  }
  if (path.startsWith('/v1/')) return `/api${path}`;
  if (!path.startsWith('/')) return `/api/v1/${path}`;
  return `/api/v1${path}`;
}

let onUnauthorizedCallback: (() => Promise<void> | void) | null = null;
export function setOnUnauthorized(cb: () => Promise<void> | void) {
  onUnauthorizedCallback = cb;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const baseUrl = useAuthStore.getState().apiUrl || env.apiUrl;
  const fullUrl = path.startsWith('http') ? path : `${baseUrl}${normalizePath(path)}`;

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(fullUrl, { ...init, headers });
  } catch (netErr) {
    throw new ApiError(0, netErr instanceof Error ? netErr.message : 'Network connection failed', null);
  }

  if (res.status === 401 && token) {
    // Session expired or token invalid -> clear store cleanly
    await useAuthStore.getState().signOut();
    if (onUnauthorizedCallback) {
      try { await onUnauthorizedCallback(); } catch {}
    }
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = extractDetail(body) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, body);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

// FastAPI returns detail as a string or as an array of validation error objects.
function extractDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const detail = (body as Record<string, unknown>).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as Record<string, unknown>;
    return typeof first?.msg === 'string' ? first.msg : JSON.stringify(first);
  }
  return null;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, json?: Json) =>
    request<T>(path, { method: 'POST', body: json ? JSON.stringify(json) : null }),
  put: <T>(path: string, json?: Json) =>
    request<T>(path, { method: 'PUT', body: json ? JSON.stringify(json) : null }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
};

export { ApiError };
