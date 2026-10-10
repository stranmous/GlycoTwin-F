import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'tamagui';
import { MotiView } from 'moti';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg';
import React from 'react';

import { PressableScale } from '../../src/components/motion/PressableScale';
import { checkEmailVerified, resendVerificationEmail, signOut, deleteCurrentUser } from '../../src/lib/firebase';
import { useAuthStore } from '../../src/lib/authStore';
import { env } from '../../src/lib/env';

// ── Mini logo (same as BootLoader) ────────────────────────────────────────────
function PulsingLogo() {
  const logoScale = useSharedValue(0.85);
  const logoOpacity = useSharedValue(0);
  const id = React.useId().replace(/:/g, '');

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600 });
    logoScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.4)) });
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <View style={s.logoWrapper}>
      <Animated.View style={[s.logoContainer, logoStyle]}>
        <Svg width={160} height={160} viewBox="0 0 650 650" fill="none">
          <Defs>
            <LinearGradient id={`v0-${id}`} x1="125.938" y1="158.437" x2="524.063" y2="491.562" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#62F4F1" />
              <Stop offset="0.56" stopColor="#A7FF3F" />
              <Stop offset="1" stopColor="#FFB24C" />
            </LinearGradient>
            <LinearGradient id={`v1-${id}`} x1="125.938" y1="158.437" x2="524.062" y2="491.562" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#62F4F1" />
              <Stop offset="0.56" stopColor="#A7FF3F" />
              <Stop offset="1" stopColor="#FFB24C" />
            </LinearGradient>
            <LinearGradient id={`v2-${id}`} x1="138.125" y1="251.875" x2="511.875" y2="416.406" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#62F4F1" />
              <Stop offset="1" stopColor="#A7FF3F" />
            </LinearGradient>
          </Defs>
          <Path d="M188.906 369.687C123.906 310.781 136.094 205.156 227.5 158.437C322.969 109.687 424.531 152.344 444.844 249.844C463.125 353.437 361.563 414.375 270.156 381.875C225.469 365.625 197.031 333.125 195 294.531" stroke="#26314D" strokeOpacity="0.7" strokeWidth="44.6875" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M461.094 280.312C526.094 339.219 513.906 444.844 422.5 491.562C327.031 540.312 225.469 497.656 205.156 400.156C186.875 296.562 288.438 235.625 379.844 268.125C424.531 284.375 452.969 316.875 455 355.469" stroke="#26314D" strokeOpacity="0.7" strokeWidth="44.6875" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M188.906 369.687C123.906 310.781 136.094 205.156 227.5 158.437C322.969 109.687 424.531 152.344 444.844 249.844C463.125 353.437 361.563 414.375 270.156 381.875C225.469 365.625 197.031 333.125 195 294.531" stroke={`url(#v0-${id})`} strokeWidth="26.4062" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M461.094 280.312C526.094 339.219 513.906 444.844 422.5 491.562C327.031 540.312 225.469 497.656 205.156 400.156C186.875 296.562 288.438 235.625 379.844 268.125C424.531 284.375 452.969 316.875 455 355.469" stroke={`url(#v1-${id})`} strokeWidth="26.4062" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M142.188 333.125C190.938 333.125 211.25 333.125 235.625 333.125C268.125 333.125 264.062 249.844 300.625 249.844C339.219 249.844 337.188 416.406 375.781 416.406C412.344 416.406 406.25 333.125 438.75 333.125C465.156 333.125 481.406 333.125 511.875 333.125" stroke="#050914" strokeWidth="42.6562" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M142.188 333.125C190.938 333.125 211.25 333.125 235.625 333.125C268.125 333.125 264.062 249.844 300.625 249.844C339.219 249.844 337.188 416.406 375.781 416.406C412.344 416.406 406.25 333.125 438.75 333.125C465.156 333.125 481.406 333.125 511.875 333.125" stroke={`url(#v2-${id})`} strokeWidth="16.25" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M172.656 223.438V178.75H221.406M477.344 223.438V178.75H428.594M172.656 426.562V471.25H221.406M477.344 426.562V471.25H428.594" stroke="#FFF8EA" strokeOpacity="0.66" strokeWidth="14.2188" strokeLinecap="round" />
          <Circle cx="300.625" cy="249.844" r="26.406" fill="#050914" />
          <Circle cx="300.625" cy="249.844" r="16.25" fill="#62F4F1" />
          <Circle cx="375.781" cy="416.406" r="26.406" fill="#050914" />
          <Circle cx="375.781" cy="416.406" r="16.25" fill="#A7FF3F" />
          <Circle cx="455" cy="333.125" r="30.469" fill="#050914" />
          <Circle cx="455" cy="333.125" r="18.281" fill="#FFB24C" />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ── Dot ellipsis animation ─────────────────────────────────────────────────────
function AnimatedDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => clearInterval(id);
  }, []);
  return <Text style={s.dots}>{dots}</Text>;
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function VerifyEmail() {
  const router = useRouter();
  const signOutFn = useAuthStore((s) => s.signOut);
  const setEmailVerified = useAuthStore((s) => s.setEmailVerified);
  const [resent, setResent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling: check every 3 s whether the user has verified their email
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        // In dev-bypass mode skip to consent immediately
        if (env.authDevBypass) {
          clearInterval(pollingRef.current!);
          router.replace('/(onboarding)/consent');
          setTimeout(() => setEmailVerified(true), 100);
          return;
        }
        const verified = await checkEmailVerified();
        if (verified) {
          clearInterval(pollingRef.current!);
          router.replace('/(onboarding)/consent');
          setTimeout(() => setEmailVerified(true), 100);
        }
      } catch {
        // silent — keep polling
      }
    }, 3000);
  }, [router, setEmailVerified]);

  useEffect(() => {
    startPolling();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [startPolling]);

  // ── Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleResend() {
    if (resendCooldown > 0) return;
    try {
      await resendVerificationEmail();
      setResent(true);
      setResendCooldown(60); // 60 s cooldown
    } catch {
      // ignore
    }
  }

  async function handleCancel() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    // Delete the unverified Firebase account so it doesn't linger in the console
    await deleteCurrentUser().catch(() => {});
    // Then sign out Firebase session + clear local store
    await signOut().catch(() => {});
    await signOutFn().catch(() => {});
    setEmailVerified(true); // reset so AuthGate works normally after logout
    router.replace('/(auth)/welcome');
  }

  return (
    <View style={s.screen}>
      <SafeAreaView style={s.safe}>
        {/* Logo + pulse rings */}
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 18, delay: 80 }}
          style={{ alignItems: 'center' }}
        >
          <PulsingLogo />

          {/* Wordmark */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: 250 }}
            style={{ alignItems: 'center', marginTop: 16 }}
          >
            <Text style={s.brand}>
              <Text color="#FFF8EA">Glyco</Text>
              <Text color="#2DD4BF">Twin</Text>
            </Text>
          </MotiView>
        </MotiView>

        {/* Card */}
        <MotiView
          from={{ opacity: 0, translateY: 24 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18, delay: 350 }}
          style={s.card}
        >
          {/* Email icon glyph */}
          <Text style={s.emailIcon}>✉️</Text>

          <Text style={s.title}>Check your inbox</Text>
          <Text style={s.subtitle}>
            We sent a verification link to your email.{'\n'}
            Open it to activate your account.
          </Text>

          {/* Live waiting indicator */}
          <View style={s.waitRow}>
            <View style={s.dot} />
            <Text style={s.waitText}>Waiting for verification</Text>
            <AnimatedDots />
          </View>

          {/* Divider */}
          <View style={s.divider} />

          {/* Resend */}
          <PressableScale
            onPress={handleResend}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            disabled={resendCooldown > 0}
          >
            <Text style={[s.linkText, resendCooldown > 0 && s.linkDisabled]}>
              {resendCooldown > 0
                ? `Resend email in ${resendCooldown}s`
                : resent
                ? '✓ Email resent!'
                : 'Resend verification email'}
            </Text>
          </PressableScale>
        </MotiView>

        {/* Cancel / back to welcome */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 600, delay: 600 }}
          style={{ alignItems: 'center', marginTop: 32 }}
        >
          <PressableScale onPress={handleCancel} hitSlop={{ top: 12, bottom: 12, left: 40, right: 40 }}>
            <Text style={s.cancelText}>Cancel — back to Welcome</Text>
          </PressableScale>
        </MotiView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0E1726',
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Logo (no rings, no glow)
  logoWrapper: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Text
  brand: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 36,
    letterSpacing: -1,
  },
  // ── Card
  card: {
    marginTop: 40,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(186,202,197,0.1)',
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  emailIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: '#FFF8EA',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    color: 'rgba(186,202,197,0.65)',
    textAlign: 'center',
    lineHeight: 22,
  },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: 'rgba(45,212,191,0.08)',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: '#2DD4BF',
  },
  waitText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 13,
    color: '#2DD4BF',
  },
  dots: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 13,
    color: '#2DD4BF',
    width: 20,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(186,202,197,0.08)',
    marginVertical: 4,
  },
  linkText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#2DD4BF',
    textAlign: 'center',
  },
  linkDisabled: {
    color: 'rgba(186,202,197,0.4)',
  },
  cancelText: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
    color: 'rgba(186,202,197,0.4)',
    textDecorationLine: 'underline',
  },
});
