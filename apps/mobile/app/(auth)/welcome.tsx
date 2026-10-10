import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import type { DimensionValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { LogoMark } from '../../src/components/Logo';

function AmbientOrb({
  size, left, top, color, delay,
}: { size: number; left: string | number; top: string | number; color: string; delay: number }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(0.18);
  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-18, { duration: 3200 + delay }),
        withTiming(0, { duration: 3200 + delay }),
      ),
      -1,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.32, { duration: 2400 + delay }),
        withTiming(0.12, { duration: 2400 + delay }),
      ),
      -1,
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          left: left as DimensionValue,
          top: top as DimensionValue,
        },
        style,
      ]}
    />
  );
}

export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View f={1} bg="#0E1726">
      {/* Ambient floating orbs — depth layer */}
      <AmbientOrb size={180} left="60%" top="5%" color="rgba(45,212,191,0.22)" delay={0} />
      <AmbientOrb size={120} left="-8%" top="42%" color="rgba(59,130,246,0.18)" delay={700} />
      <AmbientOrb size={90} left="70%" top="68%" color="rgba(45,212,191,0.12)" delay={1400} />

      {/* Full-screen gradient hero */}
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFillObject}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="heroBg" x1="0" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#006b5f" stopOpacity="0.45" />
            <Stop offset="0.4" stopColor="#0E1726" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="heroBg2" x1="1" y1="1" x2="0.3" y2="0">
            <Stop offset="0" stopColor="#0058be" stopOpacity="0.2" />
            <Stop offset="0.5" stopColor="#0E1726" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroBg)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroBg2)" />
      </Svg>

      <SafeAreaView style={styles.safe}>
        {/* Logo — centered, large */}
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 16, stiffness: 140, delay: 60 }}
          style={styles.logoArea}
        >
          <LogoMark size={160} />
          <Text style={styles.wordmark}>
            Glyco<Text style={styles.wordmarkAccent}>Twin</Text>
          </Text>
          <Text style={styles.wordmarkSub}>{t('app.tagline')}</Text>
        </MotiView>

        {/* Hero text */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 280, damping: 18, stiffness: 130 }}
          style={styles.heroArea}
        >
          <Text style={styles.heroBody} color="rgba(186,202,197,0.75)">
            {t('auth.welcomeBody')}
          </Text>

          {/* Mint divider accent */}
          <View
            height={3}
            width={48}
            bg="$primary"
            br="$8"
            mt="$4"
            style={{
              shadowColor: 'rgba(45,212,191,0.6)',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 8,
            }}
          />
        </MotiView>

        {/* Bottom CTAs */}
        <MotiView
          from={{ opacity: 0, translateY: 24 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', delay: 440 }}
          style={[styles.actions, { marginTop: 64 }]}
        >
          <GlowButton
            label={t('auth.getStarted')}
            glow
            size="xl"
            onPress={() => router.push('/(auth)/signup')}
          />
          <View mt="$4">
            <GlowButton
              label={t('auth.haveAccount')}
              variant="ghost"
              size="xl"
              onPress={() => router.push('/(auth)/login')}
            />
          </View>
        </MotiView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  logoArea: {
    marginTop: 48,
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 30,
    color: '#FFF8EA',
    letterSpacing: -0.6,
    marginTop: 14,
  },
  wordmarkAccent: {
    color: '#2DD4BF',
  },
  wordmarkSub: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
    color: 'rgba(186,202,197,0.55)',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  heroArea: {
    marginTop: 44,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -1,
  },
  heroBody: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 16,
    lineHeight: 25,
    marginTop: 12,
  },
  actions: {
    paddingBottom: 16,
  },
});
