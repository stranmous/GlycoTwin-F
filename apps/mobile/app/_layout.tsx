import {
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, useId } from 'react';
import { useColorScheme, View, StyleSheet, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from 'tamagui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat,
  withSequence, Easing, FadeOut,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop, Circle, Ellipse } from 'react-native-svg';

import config from '../tamagui.config';
import { initI18n } from '../src/lib/i18n';
import { useAuthStore } from '../src/lib/authStore';
import { useThemeStore } from '../src/lib/themeStore';
import { api } from '../src/lib/apiClient';

LogBox.ignoreLogs(['fontFamily']);
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// ── Boot Loading Screen (Stitch "Loading Screen" aesthetic) ──────────────────
function BootLoader() {
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const logoScale = useSharedValue(0.85);
  const logoOpacity = useSharedValue(0);
  const id = useId().replace(/:/g, '');

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600 });
    logoScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.4)) });
    ring1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 200 }),
      ),
      -1,
    );
    ring2.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 400 }),
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 200 }),
      ),
      -1,
    );
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    opacity: 0.6 - ring1.value * 0.6,
    transform: [{ scale: 1 + ring1.value * 0.55 }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: 0.45 - ring2.value * 0.45,
    transform: [{ scale: 1 + ring2.value * 0.8 }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <View style={styles.bootContainer}>
      {/* Ambient background glow */}
      <View style={styles.bootGlow} />

      {/* Pulse rings */}
      <Animated.View style={[styles.ring, styles.ring2, ring2Style]} />
      <Animated.View style={[styles.ring, styles.ring1, ring1Style]} />

      {/* Logo */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Svg width={100} height={100} viewBox="0 0 650 650" fill="none">
          <Defs>
            <LinearGradient id={`lg0-${id}`} x1="125.938" y1="158.437" x2="524.063" y2="491.562" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#62F4F1" />
              <Stop offset="0.56" stopColor="#A7FF3F" />
              <Stop offset="1" stopColor="#FFB24C" />
            </LinearGradient>
            <LinearGradient id={`lg1-${id}`} x1="125.938" y1="158.437" x2="524.062" y2="491.562" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#62F4F1" />
              <Stop offset="0.56" stopColor="#A7FF3F" />
              <Stop offset="1" stopColor="#FFB24C" />
            </LinearGradient>
            <LinearGradient id={`lg2-${id}`} x1="138.125" y1="251.875" x2="511.875" y2="416.406" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#62F4F1" />
              <Stop offset="1" stopColor="#A7FF3F" />
            </LinearGradient>
          </Defs>
          {/* Outer shadow loops */}
          <Path d="M188.906 369.687C123.906 310.781 136.094 205.156 227.5 158.437C322.969 109.687 424.531 152.344 444.844 249.844C463.125 353.437 361.563 414.375 270.156 381.875C225.469 365.625 197.031 333.125 195 294.531" stroke="#26314D" strokeOpacity="0.7" strokeWidth="44.6875" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M461.094 280.312C526.094 339.219 513.906 444.844 422.5 491.562C327.031 540.312 225.469 497.656 205.156 400.156C186.875 296.562 288.438 235.625 379.844 268.125C424.531 284.375 452.969 316.875 455 355.469" stroke="#26314D" strokeOpacity="0.7" strokeWidth="44.6875" strokeLinecap="round" strokeLinejoin="round" />
          {/* Gradient loops */}
          <Path d="M188.906 369.687C123.906 310.781 136.094 205.156 227.5 158.437C322.969 109.687 424.531 152.344 444.844 249.844C463.125 353.437 361.563 414.375 270.156 381.875C225.469 365.625 197.031 333.125 195 294.531" stroke={`url(#lg0-${id})`} strokeWidth="26.4062" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M461.094 280.312C526.094 339.219 513.906 444.844 422.5 491.562C327.031 540.312 225.469 497.656 205.156 400.156C186.875 296.562 288.438 235.625 379.844 268.125C424.531 284.375 452.969 316.875 455 355.469" stroke={`url(#lg1-${id})`} strokeWidth="26.4062" strokeLinecap="round" strokeLinejoin="round" />
          {/* Glucose waveform */}
          <Path d="M142.188 333.125C190.938 333.125 211.25 333.125 235.625 333.125C268.125 333.125 264.062 249.844 300.625 249.844C339.219 249.844 337.188 416.406 375.781 416.406C412.344 416.406 406.25 333.125 438.75 333.125C465.156 333.125 481.406 333.125 511.875 333.125" stroke="#050914" strokeWidth="42.6562" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M142.188 333.125C190.938 333.125 211.25 333.125 235.625 333.125C268.125 333.125 264.062 249.844 300.625 249.844C339.219 249.844 337.188 416.406 375.781 416.406C412.344 416.406 406.25 333.125 438.75 333.125C465.156 333.125 481.406 333.125 511.875 333.125" stroke={`url(#lg2-${id})`} strokeWidth="16.25" strokeLinecap="round" strokeLinejoin="round" />
          {/* Corner brackets */}
          <Path d="M172.656 223.438V178.75H221.406M477.344 223.438V178.75H428.594M172.656 426.562V471.25H221.406M477.344 426.562V471.25H428.594" stroke="#FFF8EA" strokeOpacity="0.66" strokeWidth="14.2188" strokeLinecap="round" />
          {/* Data node dots */}
          <Circle cx="300.625" cy="249.844" r="26.406" fill="#050914" />
          <Circle cx="300.625" cy="249.844" r="16.25" fill="#62F4F1" />
          <Circle cx="375.781" cy="416.406" r="26.406" fill="#050914" />
          <Circle cx="375.781" cy="416.406" r="16.25" fill="#A7FF3F" />
          <Circle cx="455" cy="333.125" r="30.469" fill="#050914" />
          <Circle cx="455" cy="333.125" r="18.281" fill="#FFB24C" />
        </Svg>
      </Animated.View>

      {/* Wordmark */}
      <Animated.Text style={[styles.wordmark, logoStyle]}>
        Glyco<Animated.Text style={styles.wordmarkAccent}>Twin</Animated.Text>
      </Animated.Text>
      <Animated.Text style={[styles.tagline, logoStyle]}>
        Your glucose digital twin
      </Animated.Text>
    </View>
  );
}

// ── Theme shell ──────────────────────────────────────────────────────────────
function ThemedShell({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const pref = useThemeStore((s) => s.pref);
  const themeName = pref === 'system' ? (system ?? 'dark') : pref;
  return <Theme name={themeName as 'light' | 'dark'}>{children}</Theme>;
}

// ── Auth gate ────────────────────────────────────────────────────────────────
function AuthGate({ appReady }: { appReady: boolean }) {
  const router = useRouter();
  const segments = useSegments();
  const { token, hydrated, emailVerified } = useAuthStore();

  useEffect(() => {
    if (!appReady || !hydrated) return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    // If not logged in and not in auth screens → send to welcome
    if (!token && !inAuth) {
      router.replace('/(auth)/welcome');
    } else if (token && emailVerified && (inAuth || (segments.length as number) === 0)) {
      // Check onboarding status before routing
      if (!inOnboarding) {
        api.get<{ consent_accepted_at: string | null }>('/v1/me')
          .then((me) => {
            if (me?.consent_accepted_at) {
              router.replace('/(tabs)');
            } else {
              router.replace('/(onboarding)/consent');
            }
          })
          .catch(() => {
            router.replace('/(onboarding)/consent');
          });
      }
    }
    // If token exists but emailVerified is false, the user is on verify-email — do nothing.
  }, [token, hydrated, emailVerified, segments, router, appReady]);

  return null;
}

// ── Root layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const system = useColorScheme();
  const pref = useThemeStore((s) => s.pref);
  const themeName = pref === 'system' ? (system ?? 'dark') : pref;

  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([initI18n(), hydrateAuth(), hydrateTheme()]);
      } catch (e) {
        console.error('[RootLayout] init error:', e);
      } finally {
        setReady(true);
      }
    })();
  }, [hydrateAuth, hydrateTheme]);

  const fontsReady = fontsLoaded || !!fontError;
  const appReady = ready && fontsReady;

  useEffect(() => {
    if (appReady) SplashScreen.hideAsync().catch(() => {});
  }, [appReady]);

  const tamaguiDefault = useMemo(() => 'dark' as const, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config} defaultTheme={tamaguiDefault}>
        <ThemedShell>
          <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
              <StatusBar style="auto" />
              <AuthGate appReady={appReady} />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: themeName === 'dark' ? '#0E1726' : '#FAFAFA' } }} />
              {!appReady && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}>
                  <BootLoader />
                </View>
              )}
            </QueryClientProvider>
          </SafeAreaProvider>
        </ThemedShell>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    backgroundColor: '#0E1726',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(45,212,191,0.08)',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -160 }, { translateY: -200 }],
  },
  ring: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: 'rgba(45,212,191,0.5)',
  },
  ring1: { width: 160, height: 160 },
  ring2: { width: 220, height: 220 },
  logoContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  wordmark: {
    // Fallback to system font so BootLoader doesn't warn before fonts load
    fontWeight: '900',
    fontSize: 32,
    color: '#FFF8EA',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  wordmarkAccent: {
    color: '#2DD4BF',
  },
  tagline: {
    fontWeight: '500',
    fontSize: 14,
    color: 'rgba(255,248,234,0.5)',
    letterSpacing: 0.5,
  },
});
