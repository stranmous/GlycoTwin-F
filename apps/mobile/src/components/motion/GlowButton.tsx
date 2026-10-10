import { ReactNode, useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Text, useTheme, View } from 'tamagui';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ReactNode;
  glow?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  style?: ViewStyle;
};

export function GlowButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  glow = false,
  disabled,
  fullWidth = true,
  size = 'md',
  style,
}: Props) {
  const theme = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!glow) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
      -1,
      true,
    );
  }, [glow, pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  const palette = {
    primary: {
      bg: theme.primary?.val ?? '#2DD4BF',
      fg: theme.onPrimary?.val ?? '#fff',
      glowColor: theme.shadowPrimary?.val ?? 'rgba(45,212,191,0.35)',
      border: 'transparent',
    },
    secondary: {
      bg: theme.secondary?.val ?? '#3B82F6',
      fg: theme.onSecondary?.val ?? '#fff',
      glowColor: theme.shadowBlue?.val ?? 'rgba(59,130,246,0.3)',
      border: 'transparent',
    },
    ghost: {
      bg: 'transparent',
      fg: theme.primary?.val ?? '#2DD4BF',
      glowColor: 'transparent',
      border: theme.primary?.val ?? '#2DD4BF',
    },
    danger: {
      bg: theme.danger?.val ?? '#F43F5E',
      fg: '#fff',
      glowColor: theme.shadowRose?.val ?? 'rgba(244,63,94,0.3)',
      border: 'transparent',
    },
  }[variant];

  const sizeValues = {
    sm: { py: 10, px: 20, fontSize: 14 as const },
    md: { py: 14, px: 24, fontSize: 16 as const },
    lg: { py: 18, px: 32, fontSize: 18 as const },
    xl: { py: 22, px: 40, fontSize: 20 as const },
    '2xl': { py: 28, px: 48, fontSize: 22 as const },
  }[size];

  return (
    <View
      width={fullWidth ? '100%' : undefined}
      position="relative"
      style={style}
    >
      {glow && variant !== 'ghost' ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: 9999,
              backgroundColor: palette.glowColor,
              top: -8,
              bottom: -8,
              left: -8,
              right: -8,
            },
            glowStyle,
          ]}
        />
      ) : null}

      <PressableScale
        onPress={onPress}
        disabled={disabled}
        scale={0.95}
        style={{ width: '100%' }}
        haptic={variant === 'primary' ? 'medium' : 'light'}
      >
        <View
          ai="center"
          jc="center"
          fd="row"
          gap="$2"
          style={{
            paddingVertical: sizeValues.py,
            paddingHorizontal: sizeValues.px,
            borderRadius: 9999,
            backgroundColor: palette.bg,
            borderWidth: variant === 'ghost' ? 1.5 : 0,
            borderColor: palette.border,
            opacity: disabled ? 0.45 : 1,
            shadowColor: variant !== 'ghost' && !disabled ? palette.glowColor : 'transparent',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: variant !== 'ghost' && !disabled ? 1 : 0,
            shadowRadius: 16,
            elevation: variant !== 'ghost' && !disabled ? 8 : 0,
          }}
        >
          {icon}
          <Text
            style={{
              color: palette.fg,
              fontWeight: '700',
              fontSize: sizeValues.fontSize,
              fontFamily: 'PlusJakartaSans_700Bold',
              letterSpacing: 0.3,
            }}
          >
            {label}
          </Text>
        </View>
      </PressableScale>
    </View>
  );
}
