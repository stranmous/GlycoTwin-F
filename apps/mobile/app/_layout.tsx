import {
  Nunito_300Light,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { useColorScheme, View, Text, StyleSheet, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from 'tamagui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat,
  withSequence, Easing,
} from 'react-native-reanimated';

import config from '../tamagui.config';
import { initI18n } from '../src/lib/i18n';
import { useAuthStore } from '../src/lib/authStore';
import { useThemeStore } from '../src/lib/themeStore';
import { useTwinStore } from '../src/lib/twinStore';
import { api } from '../src/lib/apiClient';
import { LogoMark } from '../src/components/Logo';

LogBox.ignoreLogs(['fontFamily']);
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// ── Boot Loading Screen (Warm Companion "Syncing Metabolism" aesthetic) ──────
function BootLoader() {
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const logoScale = useSharedValue(0.85);
  const logoOpacity = useSharedValue(0);
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600 });
    logoScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.4)) });
    ring1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 200 }),
      ),
      -1,
    );
    ring2.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 400 }),
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 200 }),
      ),
      -1,
    );

    // 3-dot bouncing animation
    dot1.value = withRepeat(
      withSequence(withTiming(-6, { duration: 450 }), withTiming(0, { duration: 450 })),
      -1,
      true,
    );
    const t1 = setTimeout(() => {
      dot2.value = withRepeat(
        withSequence(withTiming(-6, { duration: 450 }), withTiming(0, { duration: 450 })),
        -1,
        true,
      );
    }, 150);
    const t2 = setTimeout(() => {
      dot3.value = withRepeat(
        withSequence(withTiming(-6, { duration: 450 }), withTiming(0, { duration: 450 })),
        -1,
        true,
      );
    }, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    opacity: 0.5 - ring1.value * 0.5,
    transform: [{ scale: 1 + ring1.value * 0.45 }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: 0.35 - ring2.value * 0.35,
    transform: [{ scale: 1 + ring2.value * 0.7 }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const dot1Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const dot2Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const dot3Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

  return (
    <View style={styles.bootContainer}>
      {/* Ambient Warm Glows */}
      <View style={[styles.ambientOrb, styles.orbPeach]} />
      <View style={[styles.ambientOrb, styles.orbMint]} />
      <View style={[styles.ambientOrb, styles.orbButter]} />

      {/* Top Status Micro Tag */}
      <View style={styles.topTag}>
        <View style={styles.pulseDot} />
        <Text style={styles.topTagText}>SYNCING METABOLISM</Text>
      </View>

      {/* Center Hero Unit */}
      <View style={styles.centerHero}>
        {/* Concentric Pulsing Badge */}
        <View style={styles.badgeWrapper}>
          <Animated.View style={[styles.concentricRing, styles.ringOuter, ring2Style]} />
          <Animated.View style={[styles.concentricRing, styles.ringInner, ring1Style]} />
          <Animated.View style={[styles.logoBadge, logoStyle]}>
            <LogoMark size={56} />
          </Animated.View>
          <Text style={styles.sparkle1}>✨</Text>
          <Text style={styles.sparkle2}>🌱</Text>
        </View>

        {/* Wordmark */}
        <Animated.View style={[styles.wordmarkRow, logoStyle]}>
          <Text style={styles.wordmark}>
            Glyco<Text style={styles.wordmarkAccent}>Twin</Text>
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.Text style={[styles.tagline, logoStyle]}>
          Your friendly diabetes companion
        </Animated.Text>

        {/* Warm Encouragement Micro-Badge */}
        <Animated.View style={[styles.encouragementBadge, logoStyle]}>
          <Text style={styles.encouragementText}>🍯 Balanced habits, gentle days</Text>
        </Animated.View>
      </View>

      {/* Bottom Loading Rhythm & Educational Disclaimer */}
      <View style={styles.bottomSection}>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, { backgroundColor: '#2AA89A' }, dot1Style]} />
          <Animated.View style={[styles.dot, { backgroundColor: '#81C995' }, dot2Style]} />
          <Animated.View style={[styles.dot, { backgroundColor: '#FFB347' }, dot3Style]} />
        </View>
        <Text style={styles.versionText}>v1.0 • Educational Companion</Text>
        <Text style={styles.disclaimerText}>Holistic insights • Non-diagnostic guidance</Text>
      </View>
    </View>
  );
}

// ── Theme shell ──────────────────────────────────────────────────────────────
function ThemedShell({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const pref = useThemeStore((s) => s.pref);
  const themeName = pref === 'system' ? (system ?? 'light') : pref;
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
        api.get<any>('/api/v1/auth/profile')
          .catch(() => api.get<any>('/v1/me'))
          .then((profile) => {
            if (profile?.age || profile?.diabetes_type || profile?.consent_accepted_at || profile?.consent_accepted) {
              router.replace('/(tabs)');
            } else {
              router.replace('/(onboarding)/consent');
            }
          })
          .catch(() => {
            router.replace('/(tabs)');
          });
      }
    }
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
  const themeName = pref === 'system' ? (system ?? 'light') : pref;

  const [fontsLoaded, fontError] = useFonts({
    Nunito_300Light,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    // Aliasing legacy font names to prevent any missing font warnings
    PlusJakartaSans_300Light: Nunito_300Light,
    PlusJakartaSans_400Regular: Nunito_400Regular,
    PlusJakartaSans_500Medium: Nunito_500Medium,
    PlusJakartaSans_600SemiBold: Nunito_600SemiBold,
    PlusJakartaSans_700Bold: Nunito_700Bold,
    PlusJakartaSans_800ExtraBold: Nunito_800ExtraBold,
    SpaceGrotesk_300Light: Nunito_300Light,
    SpaceGrotesk_400Regular: Nunito_400Regular,
    SpaceGrotesk_500Medium: Nunito_500Medium,
    SpaceGrotesk_600SemiBold: Nunito_600SemiBold,
    SpaceGrotesk_700Bold: Nunito_700Bold,
  });

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          initI18n(),
          hydrateAuth(),
          hydrateTheme(),
          useTwinStore.getState().hydrate(),
        ]);
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

  const tamaguiDefault = useMemo(() => 'light' as const, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config} defaultTheme={tamaguiDefault}>
        <ThemedShell>
          <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
              <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
              <AuthGate appReady={appReady} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: themeName === 'dark' ? '#1C1917' : '#FFFBF5',
                  },
                }}
              />
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
    backgroundColor: '#FFFBF5',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  ambientOrb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbPeach: {
    width: 260,
    height: 260,
    backgroundColor: 'rgba(255,229,217,0.5)',
    top: -40,
    alignSelf: 'center',
  },
  orbMint: {
    width: 280,
    height: 280,
    backgroundColor: 'rgba(212,245,233,0.35)',
    top: '30%',
    alignSelf: 'center',
  },
  orbButter: {
    width: 240,
    height: 240,
    backgroundColor: 'rgba(255,243,205,0.4)',
    bottom: -20,
    alignSelf: 'center',
  },
  topTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
    shadowColor: 'rgba(61,61,61,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2AA89A',
  },
  topTagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#006A61',
    letterSpacing: 0.8,
  },
  centerHero: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrapper: {
    position: 'relative',
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  concentricRing: {
    position: 'absolute',
    borderRadius: 9999,
  },
  ringOuter: {
    width: 170,
    height: 170,
    backgroundColor: 'rgba(166,240,185,0.22)',
  },
  ringInner: {
    width: 130,
    height: 130,
    backgroundColor: 'rgba(232,222,248,0.3)',
  },
  logoBadge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(42,168,154,0.18)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
  },
  sparkle1: {
    position: 'absolute',
    top: 10,
    right: 18,
    fontSize: 16,
  },
  sparkle2: {
    position: 'absolute',
    bottom: 12,
    left: 18,
    fontSize: 14,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  wordmark: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 34,
    color: '#3D3D3D',
    letterSpacing: -0.5,
  },
  wordmarkAccent: {
    color: '#2AA89A',
  },
  tagline: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 15,
    color: '#8E8E8E',
    marginBottom: 14,
  },
  encouragementBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,229,217,0.7)',
  },
  encouragementText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#3D3D3D',
  },
  bottomSection: {
    alignItems: 'center',
    gap: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  versionText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#8E8E8E',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  disclaimerText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#8E8E8E',
  },
});
