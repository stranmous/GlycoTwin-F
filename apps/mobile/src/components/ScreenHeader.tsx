import { useEffect } from 'react';
import { StyleSheet, Platform, I18nManager } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from '@tamagui/lucide-icons';
import { MotiView } from 'moti';
import { Text, View } from 'tamagui';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence,
} from 'react-native-reanimated';

import { PressableScale } from './motion/PressableScale';

function LivePill() {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
    );
    scale.value = withRepeat(
      withSequence(withTiming(1.3, { duration: 900 }), withTiming(1, { duration: 900 })),
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
      px="$2.5"
      py={3}
      br="$8"
      bg="$primarySoft"
      borderWidth={1}
      borderColor="rgba(42,168,154,0.2)"
    >
      <Animated.View style={[styles.liveDot, dotStyle]} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  right,
  live,
  showBack,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  live?: boolean;
  showBack?: boolean;
  onBack?: () => void;
}) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isRTL = I18nManager.isRTL || i18n.language === 'ur';

  return (
    <View>
      <View fd="row" ai="center" jc="space-between" px="$4" pt="$4" pb="$3">
        {/* Left slot — back button or spacer */}
        {showBack ? (
          <MotiView
            from={{ opacity: 0, translateX: isRTL ? 12 : -12 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 18 }}
          >
            <PressableScale onPress={onBack ?? (() => router.back())} scale={0.9}>
              <View
                width={40}
                height={40}
                borderRadius={9999}
                bg="$surface"
                borderWidth={1}
                borderColor="$borderColor"
                ai="center"
                jc="center"
                style={
                  Platform.OS === 'web'
                    ? ({ boxShadow: '0 2px 8px rgba(61, 61, 61, 0.06)' } as any)
                    : {
                        shadowColor: '#3D3D3D',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 2,
                      }
                }
              >
                <ChevronLeft
                  size={20}
                  color="$color"
                  style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
                />
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
            <Text fontSize="$3" color="$colorMuted" style={{ fontFamily: 'Nunito_500Medium' }}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right slot */}
        {showBack && !right ? <View width={40} /> : right}
      </View>

      {/* Subtle warm separator */}
      <View
        mx="$4"
        mb="$1"
        height={1}
        bg="$borderColor"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 26,
    letterSpacing: -0.4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2AA89A',
  },
  liveText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: '#006A61',
    letterSpacing: 0.8,
  },
});
