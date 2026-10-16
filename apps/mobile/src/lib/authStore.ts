import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { DEFAULT_API_URL } from './env';
import type { AuthTokenOut, UserProfile } from '../types/api';

const TOKEN_KEY = 'glycotwin.auth.token';
const UID_KEY = 'glycotwin.auth.uid';
const EMAIL_KEY = 'glycotwin.auth.email';
const API_URL_KEY = 'glycotwin.auth.api_url';
const LANG_KEY = 'glycotwin.auth.lang';

// expo-secure-store is unavailable on web; fall back to localStorage.
const store = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    try { return await SecureStore.getItemAsync(key); } catch { return null; }
  },
  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch {}
      return;
    }
    try { await SecureStore.setItemAsync(key, value); } catch {}
  },
  del: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    try { await SecureStore.deleteItemAsync(key); } catch {}
  },
};

type AuthState = {
  token: string | null;
  uid: string | null;
  email: string | null;
  activeLanguage: string;
  apiUrl: string;
  emailVerified: boolean;
  hydrated: boolean;
  user: UserProfile | null;
  hydrate: () => Promise<void>;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  signUp: (params: { email: string; password: string; active_language?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  setApiUrl: (url: string) => Promise<void>;
  setEmailVerified: (verified: boolean) => void;
  setUser: (user: UserProfile | null) => void;
  setTokenManually: (params: { token: string; uid: string; email: string }) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  uid: null,
  email: null,
  activeLanguage: 'en',
  apiUrl: DEFAULT_API_URL,
  emailVerified: true,
  hydrated: false,
  user: null,

  hydrate: async () => {
    try {
      const [token, uid, email, savedApiUrl, savedLang] = await Promise.all([
        store.get(TOKEN_KEY),
        store.get(UID_KEY),
        store.get(EMAIL_KEY),
        store.get(API_URL_KEY),
        store.get(LANG_KEY),
      ]);
      set({
        token: token || null,
        uid: uid || null,
        email: email || null,
        apiUrl: savedApiUrl || DEFAULT_API_URL,
        activeLanguage: savedLang || 'en',
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  signIn: async ({ email, password }) => {
    const activeUrl = get().apiUrl || DEFAULT_API_URL;
    const res = await fetch(`${activeUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = typeof err.detail === 'string' ? err.detail : 'Invalid credentials';
      throw new Error(msg);
    }

    const data: AuthTokenOut = await res.json();
    const token = data.access_token;
    const uid = data.user?.id || 'user';
    const userEmail = data.user?.email || email.trim();
    const activeLang = data.user?.active_language || 'en';

    await Promise.all([
      store.set(TOKEN_KEY, token),
      store.set(UID_KEY, uid),
      store.set(EMAIL_KEY, userEmail),
      store.set(LANG_KEY, activeLang),
    ]);

    set({
      token,
      uid,
      email: userEmail,
      activeLanguage: activeLang,
      emailVerified: true,
    });
  },

  signUp: async ({ email, password, active_language = 'en' }) => {
    const activeUrl = get().apiUrl || DEFAULT_API_URL;
    const res = await fetch(`${activeUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password,
        active_language,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = typeof err.detail === 'string' ? err.detail : 'Registration failed';
      throw new Error(msg);
    }

    const data: AuthTokenOut = await res.json();
    const token = data.access_token;
    const uid = data.user?.id || 'user';
    const userEmail = data.user?.email || email.trim();

    await Promise.all([
      store.set(TOKEN_KEY, token),
      store.set(UID_KEY, uid),
      store.set(EMAIL_KEY, userEmail),
      store.set(LANG_KEY, active_language),
    ]);

    set({
      token,
      uid,
      email: userEmail,
      activeLanguage: active_language,
      emailVerified: true,
    });
  },

  signOut: async () => {
    await Promise.all([
      store.del(TOKEN_KEY),
      store.del(UID_KEY),
      store.del(EMAIL_KEY),
    ]);
    set({
      token: null,
      uid: null,
      email: null,
      emailVerified: true,
      user: null,
    });
  },

  deleteAccount: async () => {
    const token = get().token;
    const activeUrl = get().apiUrl || DEFAULT_API_URL;
    if (token) {
      try {
        await fetch(`${activeUrl}/api/v1/auth/me`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Continue with local sign out even if network fails
      }
    }
    await get().signOut();
  },

  setApiUrl: async (url: string) => {
    await store.set(API_URL_KEY, url);
    set({ apiUrl: url });
  },

  setEmailVerified: (verified: boolean) => set({ emailVerified: verified }),
  setUser: (user: UserProfile | null) => set({ user }),

  setTokenManually: async ({ token, uid, email }) => {
    await Promise.all([
      store.set(TOKEN_KEY, token),
      store.set(UID_KEY, uid),
      store.set(EMAIL_KEY, email),
    ]);
    set({ token, uid, email });
  },
}));
