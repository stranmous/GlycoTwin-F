import { Platform } from 'react-native';

declare const process: { env: Record<string, string | undefined> };

export const CLOUDFLARE_TUNNEL_URL = 'https://platforms-hamburg-purchase-laugh.trycloudflare.com';
export const LOCAL_WIFI_URL = 'http://192.168.20.100:8000';
export const AZURE_API_URL = 'https://glycotwin-demo.indiasouthcentral.cloudapp.azure.com';

let resolvedUrl = process.env.EXPO_PUBLIC_API_URL;
if (Platform.OS === 'android') {
  if (!resolvedUrl || resolvedUrl.includes('localhost') || resolvedUrl.includes('127.0.0.1') || resolvedUrl.includes('10.0.2.2')) {
    resolvedUrl = CLOUDFLARE_TUNNEL_URL;
  }
} else {
  resolvedUrl = resolvedUrl || 'http://localhost:8000';
}

export const DEFAULT_API_URL = resolvedUrl;

export const env = {
  apiUrl: DEFAULT_API_URL,
  defaultApiUrl: DEFAULT_API_URL,
  tunnelUrl: CLOUDFLARE_TUNNEL_URL,
  wifiUrl: LOCAL_WIFI_URL,
  azureApiUrl: AZURE_API_URL,
  authDevBypass: process.env.EXPO_PUBLIC_AUTH_DEV_BYPASS === 'true',
};
