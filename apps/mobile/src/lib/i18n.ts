import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { I18nManager, Platform } from 'react-native';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import ur from '../locales/ur.json';

const LANG_KEY = 'glycotwin.lang';

export const SUPPORTED = ['en', 'ur'] as const;
export type SupportedLang = (typeof SUPPORTED)[number];

// Register the React plugin and seed resources synchronously at module load.
// This ensures useTranslation works on the very first render, before initI18n()
// has resolved the user's stored language — preventing a hooks-order violation.
i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: { en: { translation: en }, ur: { translation: ur } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initImmediate: false, // synchronous
});

// Called once at startup to apply the user's stored/device language.
export async function initI18n() {
  const stored = (await AsyncStorage.getItem(LANG_KEY)) as SupportedLang | null;
  const device = Localization.getLocales()[0]?.languageCode as SupportedLang | undefined;
  const lang: SupportedLang = stored ?? (device && SUPPORTED.includes(device) ? device : 'en');

  if (i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }
  applyDirection(lang);
  return i18n;
}

export async function setLanguage(lang: SupportedLang): Promise<{ needsReload: boolean }> {
  await AsyncStorage.setItem(LANG_KEY, lang);
  await i18n.changeLanguage(lang);
  return applyDirection(lang);
}

function applyDirection(lang: SupportedLang): { needsReload: boolean } {
  const wantRTL = lang === 'ur';
  
  if (Platform.OS === 'web') {
    document.documentElement.dir = wantRTL ? 'rtl' : 'ltr';
  }

  if (I18nManager.isRTL !== wantRTL) {
    I18nManager.allowRTL(wantRTL);
    I18nManager.forceRTL(wantRTL);
    return { needsReload: true };
  }
  return { needsReload: false };
}
