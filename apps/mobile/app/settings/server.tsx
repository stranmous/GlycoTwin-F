import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme } from 'tamagui';
import { CheckCircle2, Globe, Radio, Server, Wifi, XCircle } from '@tamagui/lucide-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { ScreenHeader } from '../../src/components/ScreenHeader';
import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { useAuthStore } from '../../src/lib/authStore';
import {
  AZURE_API_URL,
  CLOUDFLARE_TUNNEL_URL,
  LOCAL_WIFI_URL,
} from '../../src/lib/env';

export default function ServerSettings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { apiUrl, setApiUrl } = useAuthStore();

  const [urlInput, setUrlInput] = useState(apiUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const presets = [
    {
      id: 'tunnel',
      name: 'Cloudflare Tunnel (Recommended)',
      desc: 'Connects directly to your laptop backend from any Wi-Fi or cellular network.',
      url: CLOUDFLARE_TUNNEL_URL,
      icon: <Globe size={20} color="#006A61" />,
    },
    {
      id: 'wifi',
      name: 'Local Laptop Wi-Fi',
      desc: 'Connects via your local router IP (laptop & phone must be on same Wi-Fi).',
      url: LOCAL_WIFI_URL,
      icon: <Wifi size={20} color="#006A61" />,
    },
    {
      id: 'azure',
      name: 'Azure Cloud VM',
      desc: 'Connects to the cloud-hosted GlycoTwin backend instance.',
      url: AZURE_API_URL,
      icon: <Server size={20} color="#006A61" />,
    },
  ];

  async function testConnection(targetUrl: string) {
    setTesting(true);
    setTestResult(null);
    const cleanUrl = targetUrl.trim().replace(/\/+$/, '');
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(`${cleanUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      if (res.ok) {
        setTestResult({
          success: true,
          message: `Connected successfully! (HTTP 200 OK - ${latency}ms)`,
          latencyMs: latency,
        });
      } else {
        setTestResult({
          success: false,
          message: `Server reachable but returned HTTP ${res.status}`,
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message:
          err instanceof Error && err.name === 'AbortError'
            ? 'Connection timed out (7s). Check your laptop network.'
            : err instanceof Error
            ? err.message
            : 'Could not connect to server.',
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    const cleanUrl = urlInput.trim().replace(/\/+$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      const msg = 'URL must start with http:// or https://';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Invalid URL', msg);
      return;
    }
    await setApiUrl(cleanUrl);
    qc.invalidateQueries();
    const msg = `Backend updated to:\n${cleanUrl}`;
    if (Platform.OS === 'web') {
      window.alert(msg);
      router.back();
    } else {
      Alert.alert('Backend Updated', msg, [{ text: 'OK', onPress: () => router.back() }]);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <RNView style={{ flex: 1 }}>
        <ScreenHeader title="Backend Server" showBack />

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Active Status Card */}
          <RNView
            style={[
              styles.card,
              {
                backgroundColor: theme.surface.val,
                borderColor: theme.borderColor.val,
              },
            ]}
          >
            <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <RNView style={styles.badgeDot} />
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: theme.color.val }}>
                Active Endpoint
              </Text>
            </RNView>
            <Text
              style={{
                fontFamily: 'Nunito_600SemiBold',
                fontSize: 14,
                color: '#006A61',
                backgroundColor: '#D4F5E9',
                padding: 10,
                borderRadius: 10,
              }}
              numberOfLines={2}
            >
              {apiUrl}
            </Text>
          </RNView>

          {/* Presets List */}
          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: theme.colorMuted.val, marginTop: 4 }}>
            SELECT PRESET
          </Text>

          <RNView style={{ gap: 10 }}>
            {presets.map((preset) => {
              const isSelected = urlInput.trim() === preset.url.trim();
              return (
                <PressableScale
                  key={preset.id}
                  onPress={() => {
                    setUrlInput(preset.url);
                    testConnection(preset.url);
                  }}
                  scale={0.98}
                >
                  <RNView
                    style={[
                      styles.presetCard,
                      {
                        backgroundColor: theme.surface.val,
                        borderColor: isSelected ? '#2AA89A' : theme.borderColor.val,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <RNView style={styles.iconCircle}>{preset.icon}</RNView>
                    <RNView style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 15, color: theme.color.val }}>
                        {preset.name}
                      </Text>
                      <Text style={{ fontFamily: 'Nunito_500Medium', fontSize: 12, color: theme.colorMuted.val, lineHeight: 16 }}>
                        {preset.desc}
                      </Text>
                      <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#006A61', marginTop: 2 }}>
                        {preset.url}
                      </Text>
                    </RNView>
                  </RNView>
                </PressableScale>
              );
            })}
          </RNView>

          {/* Custom URL Input */}
          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: theme.colorMuted.val, marginTop: 8 }}>
            CUSTOM ENDPOINT
          </Text>

          <RNView
            style={[
              styles.card,
              {
                backgroundColor: theme.surface.val,
                borderColor: theme.borderColor.val,
              },
            ]}
          >
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://..."
              placeholderTextColor={theme.colorMuted.val}
              style={[
                styles.input,
                { color: theme.color.val, borderColor: theme.borderColor.val },
              ]}
            />

            {testResult ? (
              <RNView
                style={[
                  styles.testResultBox,
                  {
                    backgroundColor: testResult.success ? '#D4F5E9' : '#FFE5D9',
                    borderColor: testResult.success ? '#81C995' : '#FF8A80',
                  },
                ]}
              >
                {testResult.success ? (
                  <CheckCircle2 size={18} color="#006A61" />
                ) : (
                  <XCircle size={18} color="#D32F2F" />
                )}
                <Text
                  style={{
                    fontFamily: 'Nunito_700Bold',
                    fontSize: 13,
                    color: testResult.success ? '#006A61' : '#D32F2F',
                    flex: 1,
                  }}
                >
                  {testResult.message}
                </Text>
              </RNView>
            ) : null}

            <RNView style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <GlowButton
                label={testing ? 'Testing...' : 'Test Connection'}
                variant="secondary"
                disabled={testing}
                onPress={() => testConnection(urlInput)}
                style={{ flex: 1 }}
              />
              <GlowButton
                label="Save & Apply"
                variant="primary"
                glow
                onPress={handleSave}
                style={{ flex: 1 }}
              />
            </RNView>
          </RNView>
        </ScrollView>
      </RNView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 3px 10px rgba(61, 61, 61, 0.05)' } as any)
      : {
          shadowColor: '#3D3D3D',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 2,
        }),
  },
  presetCard: {
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 6px rgba(61, 61, 61, 0.04)' } as any)
      : {
          shadowColor: '#3D3D3D',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 1,
        }),
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D4F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#81C995',
  },
  input: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
});
