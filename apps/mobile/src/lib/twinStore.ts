import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { api, setOnUnauthorized } from './apiClient';
import { useAuthStore } from './authStore';
import type { CalibratedState, UserProfile } from '../types/api';

const TWIN_KEY = 'glycotwin.twin.state';
const LAST_CAL_KEY = 'glycotwin.twin.last_calibrated_at';

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

export const createDefaultCalibratedState = (userId = 'user'): CalibratedState => ({
  user_id: userId,
  phenotype_cluster_id: 'type_2_insulin_resistant',
  baseline_glucose_mg_dl: 98.4,
  estimated_insulin_sensitivity: 0.041,
  carb_absorption_rate_index: 0.027,
  confidence_score: 0.82,
  is_cold_start: true,
  estimation_method: 'demographic_default',
});

type TwinStoreState = {
  calibratedState: CalibratedState | null;
  isCalibrating: boolean;
  lastCalibratedAt: string | null;
  error: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setCalibratedState: (state: CalibratedState) => Promise<void>;
  calibrateTwin: (
    profile?: Partial<UserProfile>,
    cgmReadings?: Array<{ glucose_mg_dl: number; timestamp?: string }>,
    mealRecords?: Array<{ carbs_g: number; eaten_at?: string }>
  ) => Promise<CalibratedState>;
  reset: () => Promise<void>;
};

export const useTwinStore = create<TwinStoreState>((set, get) => ({
  calibratedState: null,
  isCalibrating: false,
  lastCalibratedAt: null,
  error: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const [savedState, savedTime] = await Promise.all([
        store.get(TWIN_KEY),
        store.get(LAST_CAL_KEY),
      ]);
      const uid = useAuthStore.getState().uid || 'user';
      let state: CalibratedState | null = null;
      if (savedState) {
        try {
          state = JSON.parse(savedState);
        } catch {
          state = createDefaultCalibratedState(uid);
        }
      } else {
        state = createDefaultCalibratedState(uid);
      }
      set({
        calibratedState: state,
        lastCalibratedAt: savedTime,
        hydrated: true,
      });
    } catch {
      const uid = useAuthStore.getState().uid || 'user';
      set({
        calibratedState: createDefaultCalibratedState(uid),
        hydrated: true,
      });
    }
  },

  setCalibratedState: async (state: CalibratedState) => {
    const now = new Date().toISOString();
    await Promise.all([
      store.set(TWIN_KEY, JSON.stringify(state)),
      store.set(LAST_CAL_KEY, now),
    ]);
    set({
      calibratedState: state,
      lastCalibratedAt: now,
      error: null,
    });
  },

  calibrateTwin: async (profile, cgmReadings = [], mealRecords = []) => {
    set({ isCalibrating: true, error: null });
    const uid = useAuthStore.getState().uid || 'user';
    const activeProfile = profile || useAuthStore.getState().user || {};

    let bmi = 25.3;
    if (activeProfile.weight_kg && activeProfile.height_cm) {
      const hM = activeProfile.height_cm / 100;
      bmi = Number((activeProfile.weight_kg / (hM * hM)).toFixed(1));
    }

    const payload = {
      user_id: uid,
      user_profile: {
        user_id: uid,
        age: activeProfile.age ? Number(activeProfile.age) : 42,
        bmi,
        diabetic_type: activeProfile.diabetes_type || activeProfile.diabetic_type || 'type_2',
      },
      cgm_readings: cgmReadings,
      meal_records: mealRecords,
    };

    try {
      const res = await api.post<CalibratedState>('/api/v1/calibration/calibrate', payload as any);
      const state: CalibratedState = {
        ...res,
        estimation_method: res.estimation_method || (res.is_cold_start ? 'demographic_default' : 'data_fitted'),
      };
      await get().setCalibratedState(state);
      set({ isCalibrating: false });
      return state;
    } catch (err) {
      console.warn('Calibration API request failed, using demographic default twin state:', err);
      const fallbackState = createDefaultCalibratedState(uid);
      await get().setCalibratedState(fallbackState);
      set({
        isCalibrating: false,
        error: err instanceof Error ? err.message : 'Calibration completed with demographic defaults',
      });
      return fallbackState;
    }
  },

  reset: async () => {
    await Promise.all([
      store.del(TWIN_KEY),
      store.del(LAST_CAL_KEY),
    ]);
    set({
      calibratedState: null,
      lastCalibratedAt: null,
      error: null,
    });
  },
}));

setOnUnauthorized(async () => {
  await useTwinStore.getState().reset();
});
