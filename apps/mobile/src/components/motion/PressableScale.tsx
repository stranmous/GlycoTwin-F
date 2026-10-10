import * as Haptics from 'expo-haptics';
import { ReactNode, useCallback } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Platform, Pressable, ViewStyle, StyleProp } from 'react-native';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  haptic?: 'light' | 'medium' | 'none';
  scale?: number;
  style?: ViewStyle;
  disabled?: boolean;
  accessibilityLabel?: string;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
};

export function PressableScale({
  children,
  onPress,
  haptic = 'light',
  scale = 0.96,
  style,
  disabled,
  accessibilityLabel,
  hitSlop,
}: Props) {
  const s = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
  }));

  const handleIn = useCallback(() => {
    s.value = withSpring(scale, { damping: 14, stiffness: 360 });
  }, [s, scale]);
  const handleOut = useCallback(() => {
    s.value = withSpring(1, { damping: 14, stiffness: 360 });
  }, [s]);
  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      else if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onPress?.();
  }, [haptic, onPress]);

  const handleHoverIn = useCallback(() => {
    if (Platform.OS === 'web') s.value = withSpring(1.02, { damping: 14, stiffness: 360 });
  }, [s]);
  const handleHoverOut = useCallback(() => {
    if (Platform.OS === 'web') s.value = withSpring(1, { damping: 14, stiffness: 360 });
  }, [s]);

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPressIn={handleIn}
        onPressOut={handleOut}
        onPress={handlePress}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={{ width: '100%' } as StyleProp<ViewStyle>}
        {...(Platform.OS === 'web' ? { onHoverIn: handleHoverIn, onHoverOut: handleHoverOut } : {})}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
