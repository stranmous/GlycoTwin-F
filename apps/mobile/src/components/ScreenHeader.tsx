import { useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import { Text, View } from 'tamagui';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence,
} from 'react-native-reanimated';

function LivePill() {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
    );
    scale.value = withRepeat(
      withSequence(withTiming(1.4, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
    );
  }, []);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return (
    <View
      fd="row"
      ai="center"
      gap={5}
      px="$2"
      py={3}
      br="$8"
      bg="rgba(45,212,191,0.12)"
      borderWidth={1}
      borderColor="rgba(45,212,191,0.25)"
    >
      <Animated.View style={[styles.liveDot, dotStyle]} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

import { useRouter } from 'expo-router';
import { ChevronLeft } from '@tamagui/lucide-icons';
import { MotiView } from 'moti';
import { PressableScale } from './motion/PressableScale';

export function ScreenHeader({
  title,
  subtitle,
  right,
  live,
  showBack,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  live?: boolean;
  showBack?: boolean;
}) {
  const router = useRouter();

  return (
    <View>
      <View fd="row" ai="center" jc="space-between" px="$4" pt="$4" pb="$3">
        {/* Left slot — back button or spacer */}
        {showBack ? (
          <MotiView
            from={{ opacity: 0, translateX: -12 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 18 }}
          >
            <PressableScale onPress={() => router.back()} scale={0.9}>
              <View
                width={40}
                height={40}
                borderRadius={9999}
                bg="rgba(255,255,255,0.06)"
                borderWidth={1}
                borderColor="rgba(186,202,197,0.15)"
                ai="center"
                jc="center"
              >
                <ChevronLeft size={20} color="rgba(186,202,197,0.7)" />
              </View>
            </PressableScale>
          </MotiView>
        ) : null}

        {/* Center — title */}
        <View f={1} ai={showBack ? 'center' : 'flex-start'} gap="$1">
          <View fd="row" ai="center" gap="$2">
            <Text style={styles.title} color="$color">
              {title}
            </Text>
            {live ? <LivePill /> : null}
          </View>
          {subtitle ? (
            <Text fontSize="$4" color="$colorMuted">
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right slot */}
        {showBack && !right ? <View width={40} /> : right}
      </View>

      {/* Mint gradient separator */}
      <View
        mx="$4"
        mb="$1"
        height={1}
        style={
          Platform.OS === 'web'
            ? { background: 'linear-gradient(90deg, rgba(45,212,191,0.35) 0%, rgba(45,212,191,0) 100%)' } as any
            : { backgroundColor: 'rgba(45,212,191,0.18)' }
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 28,
    letterSpacing: -0.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2DD4BF',
  },
  liveText: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 9,
    color: '#2DD4BF',
    letterSpacing: 0.8,
  },
});
