import { env } from './env';
import { useAuthStore } from './authStore';
import { getAuth } from 'firebase/auth';
import { getApps } from 'firebase/app';

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res = await fetch(`${env.apiUrl}${path}`, { ...init, headers });

  if (res.status === 401 && token) {
    try {
      if (!env.authDevBypass && getApps().length > 0) {
        const auth = getAuth();
        if (auth.currentUser) {
          const newToken = await auth.currentUser.getIdToken(true);
          await useAuthStore.getState().signIn({ 
            token: newToken, 
            uid: auth.currentUser.uid, 
            email: auth.currentUser.email ?? '' 
          });
          headers.set('Authorization', `Bearer ${newToken}`);
          res = await fetch(`${env.apiUrl}${path}`, { ...init, headers });
        }
      }
    } catch (e) {
      console.warn('Token refresh failed', e);
    }
    
    if (res.status === 401) {
      await useAuthStore.getState().signOut();
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
