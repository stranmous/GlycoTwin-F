import { Platform } from 'react-native';

declare const process: { env: Record<string, string | undefined> };

let defaultApiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
if (Platform.OS === 'android') {
  defaultApiUrl = defaultApiUrl.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
}

export const env = {
  apiUrl: defaultApiUrl,
  authDevBypass: process.env.EXPO_PUBLIC_AUTH_DEV_BYPASS === 'true',
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  },
};
