import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

const TOKEN_KEY = 'glycotwin.auth.token';
const UID_KEY = 'glycotwin.auth.uid';

// expo-secure-store is unavailable on web; fall back to localStorage.
const store = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    await SecureStore.setItemAsync(key, value);
  },
  del: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    await SecureStore.deleteItemAsync(key);
  },
};

type AuthState = {
  token: string | null;
  uid: string | null;
  email: string | null;
  emailVerified: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  signIn: (params: { token: string; uid: string; email: string }) => Promise<void>;
  signOut: () => Promise<void>;
  setEmailVerified: (verified: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  uid: null,
  email: null,
  emailVerified: true, // true by default so existing signed-in users are unaffected
  hydrated: false,
  hydrate: async () => {
    try {
      const [token, uid] = await Promise.all([store.get(TOKEN_KEY), store.get(UID_KEY)]);
      set({ token, uid, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  signIn: async ({ token, uid, email }) => {
    await store.set(TOKEN_KEY, token);
    await store.set(UID_KEY, uid);
    set({ token, uid, email });
  },
  signOut: async () => {
    await store.del(TOKEN_KEY);
    await store.del(UID_KEY);
    set({ token: null, uid: null, email: null, emailVerified: true });
  },
  setEmailVerified: (verified: boolean) => set({ emailVerified: verified }),
}));
