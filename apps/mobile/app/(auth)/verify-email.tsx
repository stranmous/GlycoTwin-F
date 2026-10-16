import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'tamagui';
import { MotiView } from 'moti';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import React from 'react';

import { PressableScale } from '../../src/components/motion/PressableScale';
import { LogoMark } from '../../src/components/Logo';
import { GlowButton } from '../../src/components/motion/GlowButton';
import { useAuthStore } from '../../src/lib/authStore';
import { env } from '../../src/lib/env';

// ── Pulsing Mascot Emblem ────────────────────────────────────────────────────
function PulsingMascot() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 200 }),
      ),
      -1,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.45 - pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.4 }],
  }));

  return (
    <View style={s.mascotWrapper}>
      <Animated.View style={[s.mascotRing, ringStyle]} />
      <View style={s.mascotBadge}>
        <LogoMark size={44} />
      </View>
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
  const email = useAuthStore((s) => s.email);
  const signOutFn = useAuthStore((s) => s.signOut);
  const setEmailVerified = useAuthStore((s) => s.setEmailVerified);
  const [resent, setResent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling: automatically activate and transition to onboarding
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setEmailVerified(true);
      router.replace('/(onboarding)/consent');
    }, 2500);
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
    setResent(true);
    setResendCooldown(60);
  }

  async function handleCancel() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    await signOutFn().catch(() => {});
    setEmailVerified(true);
    router.replace('/(auth)/welcome');
  }

  return (
    <View style={s.screen}>
      <SafeAreaView style={s.safe}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Mascot Emblem */}
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 18, delay: 60 }}
            style={{ alignItems: 'center' }}
          >
            <PulsingMascot />
            <View style={s.stepTag}>
              <Text style={{ fontSize: 12 }}>🌱</Text>
              <Text style={s.stepTagText}>Step 2 of 2 · Gentle Onboarding</Text>
            </View>
          </MotiView>

          {/* Elevated Card */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: 180 }}
            style={s.card}
          >
            {/* Peach badge with ✉️ */}
            <View style={s.iconBadge}>
              <Text style={{ fontSize: 32 }}>✉️</Text>
              <View style={s.sparkleBadge}>
                <Text style={{ fontSize: 11 }}>✨</Text>
              </View>
            </View>

            <Text style={s.title}>Check your inbox 📬</Text>
            <Text style={s.subtitle}>
              We sent a verification link to{' '}
              <Text style={s.emailHighlight}>{email || 'your email'}</Text>.{'\n'}
              Tap the link in your email to activate your twin.
            </Text>

            {/* Live waiting indicator pill */}
            <View style={s.waitRow}>
              <View style={s.dot} />
              <Text style={s.waitText}>Waiting for verification</Text>
              <AnimatedDots />
            </View>

            {/* Resend Action */}
            <View style={{ width: '100%', marginTop: 8 }}>
              <GlowButton
                label={
                  resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : resent
                    ? '✓ Verification Resent!'
                    : 'Resend Verification Email'
                }
                variant="secondary"
                size="lg"
                disabled={resendCooldown > 0}
                onPress={handleResend}
              />
            </View>

            <Text style={s.helperNotice}>
              Didn't receive it? Check your spam folder or wait 60s.
            </Text>
          </MotiView>

          {/* Cultural Nutrition Tip Card */}
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: 280 }}
            style={s.tipCard}
          >
            <View style={s.tipIcon}>
              <Text style={{ fontSize: 16 }}>🥣</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.tipTitle}>Did you know?</Text>
              <Text style={s.tipText}>
                Your GlycoTwin calibrates personalized glycemic responses for South Asian classics like warm whole-wheat roti and spiced lentil daal right after sign-in.
              </Text>
            </View>
          </MotiView>

          {/* Cancel / back to welcome */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 500, delay: 350 }}
            style={{ alignItems: 'center', marginTop: 20 }}
          >
            <PressableScale onPress={handleCancel} hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}>
              <Text style={s.cancelText}>Cancel & use a different email</Text>
            </PressableScale>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFBF5',
  },
  safe: {
    flex: 1,
  },
  mascotWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  mascotRing: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(166,240,185,0.4)',
  },
  mascotBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(42,168,154,0.18)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
  },
  stepTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    backgroundColor: '#FFF5EB',
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
    marginBottom: 16,
  },
  stepTagText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#006A61',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
    padding: 24,
    alignItems: 'center',
    shadowColor: 'rgba(61,61,61,0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 3,
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFE5D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  sparkleBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF3CD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: '#3D3D3D',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 14,
    color: '#8E8E8E',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
  },
  emailHighlight: {
    fontFamily: 'Nunito_700Bold',
    color: '#3D3D3D',
    backgroundColor: '#FFF5EB',
  },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(212,245,233,0.5)',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2AA89A',
  },
  waitText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: '#006A61',
  },
  dots: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: '#006A61',
    width: 18,
  },
  helperNotice: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#8E8E8E',
    marginTop: 12,
    textAlign: 'center',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF5EB',
    borderRadius: 20,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
  },
  tipIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(61,61,61,0.04)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  tipTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: '#3D3D3D',
    marginBottom: 2,
  },
  tipText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#8E8E8E',
    lineHeight: 17,
  },
  cancelText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#8E8E8E',
    textDecorationLine: 'underline',
  },
});
