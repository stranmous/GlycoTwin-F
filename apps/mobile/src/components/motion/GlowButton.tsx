import { ReactNode, useEffect } from 'react';
import { Platform, StyleSheet, View as RNView, ViewStyle } from 'react-native';
import { Text, useTheme } from 'tamagui';
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
    opacity: 0.2 + pulse.value * 0.3,
    transform: [{ scale: 1 + pulse.value * 0.04 }],
  }));

  const palette = {
    primary: {
      bg: theme.primary?.val ?? '#2AA89A',
      fg: theme.onPrimary?.val ?? '#FFFFFF',
      glowColor: 'rgba(42, 168, 154, 0.24)',
      shadowHex: '#2AA89A',
      border: 'transparent',
    },
    secondary: {
      bg: theme.backgroundSecondary?.val ?? '#FFF5EB',
      fg: theme.primary?.val ?? '#2AA89A',
      glowColor: 'rgba(42, 168, 154, 0.10)',
      shadowHex: '#3D3D3D',
      border: 'rgba(42, 168, 154, 0.28)',
    },
    ghost: {
      bg: 'transparent',
      fg: theme.primary?.val ?? '#2AA89A',
      glowColor: 'transparent',
      shadowHex: 'transparent',
      border: theme.primary?.val ?? '#2AA89A',
    },
    danger: {
      bg: theme.danger?.val ?? '#E57373',
      fg: '#FFFFFF',
      glowColor: 'rgba(229, 115, 115, 0.24)',
      shadowHex: '#E57373',
      border: 'transparent',
    },
  }[variant];

  const sizeValues = {
    sm: { py: 10, px: 20, minH: 40, fontSize: 14 as const },
    md: { py: 13, px: 24, minH: 48, fontSize: 16 as const },
    lg: { py: 14, px: 28, minH: 52, fontSize: 17 as const },
    xl: { py: 15, px: 32, minH: 54, fontSize: 17 as const },
    '2xl': { py: 18, px: 36, minH: 58, fontSize: 19 as const },
  }[size];

  return (
    <RNView
      style={[
        { position: 'relative', width: fullWidth ? '100%' : undefined },
        style,
      ]}
    >
      {glow && variant !== 'ghost' && !disabled ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              pointerEvents: 'none',
              borderRadius: 9999,
              backgroundColor: palette.glowColor,
              top: -4,
              bottom: -4,
              left: -4,
              right: -4,
            },
            glowStyle,
          ]}
        />
      ) : null}

      <PressableScale
        onPress={onPress}
        disabled={disabled}
        scale={0.97}
        style={{ width: fullWidth ? '100%' : undefined }}
        haptic={variant === 'primary' ? 'medium' : 'light'}
      >
        <RNView
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: sizeValues.minH,
              paddingVertical: sizeValues.py,
              paddingHorizontal: sizeValues.px,
              borderRadius: 9999,
              backgroundColor: palette.bg,
              borderWidth: variant === 'ghost' || variant === 'secondary' ? 1.5 : 0,
              borderColor: palette.border,
              opacity: disabled ? 0.45 : 1,
            },
            variant !== 'ghost' && !disabled
              ? Platform.OS === 'web'
                ? ({
                    boxShadow:
                      variant === 'primary'
                        ? '0 6px 16px rgba(42, 168, 154, 0.25)'
                        : variant === 'danger'
                        ? '0 6px 16px rgba(229, 115, 115, 0.25)'
                        : '0 2px 8px rgba(61, 61, 61, 0.05)',
                  } as any)
                : {
                    shadowColor: palette.shadowHex,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: variant === 'secondary' ? 0.06 : 0.22,
                    shadowRadius: 12,
                    elevation: 4,
                  }
              : null,
          ]}
        >
          {icon}
          <Text
            style={{
              color: palette.fg,
              fontWeight: '700',
              fontSize: sizeValues.fontSize,
              fontFamily: 'Nunito_700Bold',
              letterSpacing: 0.2,
              textAlign: 'center',
            }}
          >
            {label}
          </Text>
        </RNView>
      </PressableScale>
    </RNView>
  );
}
