import { Platform } from 'react-native';

declare const process: { env: Record<string, string | undefined> };

export const AZURE_API_URL = 'https://glycotwin-demo.indiasouthcentral.cloudapp.azure.com';

let rawLocalUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
if (Platform.OS === 'android') {
  rawLocalUrl = rawLocalUrl.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
}

export const DEFAULT_API_URL = rawLocalUrl;

export const env = {
  apiUrl: DEFAULT_API_URL,
  defaultApiUrl: DEFAULT_API_URL,
  azureApiUrl: AZURE_API_URL,
  authDevBypass: process.env.EXPO_PUBLIC_AUTH_DEV_BYPASS === 'true',
};
