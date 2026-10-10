import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'glycotwin.theme';

type ThemeState = {
  pref: ThemePref;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPref: (p: ThemePref) => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set) => ({
  pref: 'system',
  hydrated: false,
  hydrate: async () => {
    const v = (await AsyncStorage.getItem(KEY)) as ThemePref | null;
    set({ pref: v ?? 'system', hydrated: true });
  },
  setPref: async (p) => {
    await AsyncStorage.setItem(KEY, p);
    set({ pref: p });
  },
}));
