import { ReactNode } from 'react';
import { Platform, StyleSheet, ViewStyle } from 'react-native';
import { View } from 'tamagui';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  delay?: number;
  onPress?: () => void;
  glowColor?: string;
  padding?: number;
  radius?: number;
  borderColor?: string;
  animate?: boolean;
};

export function GlassCard({
  children,
  style,
  intensity = 20,
  tint = 'light',
  delay = 0,
  glowColor,
  padding = 20,
  radius = 24,
  borderColor,
  animate = true,
}: Props) {
  const border = borderColor ?? (tint === 'dark'
    ? 'rgba(255,255,255,0.1)'
    : 'rgba(255,255,255,0.6)');

  const inner = (
    <View
      style={[
        styles.card,
        {
          borderRadius: radius,
          padding,
          borderColor: border,
          ...(glowColor
            ? {
                shadowColor: glowColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 20,
                elevation: 6,
              }
            : {}),
        },
        style,
      ]}
    >
      {/* Glass blur — iOS only; Android uses semi-transparent fill */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={intensity}
          tint={tint}
          style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: radius,
              backgroundColor: tint === 'dark'
                ? 'rgba(14,23,38,0.72)'
                : 'rgba(255,255,255,0.72)',
            },
          ]}
        />
      )}
      {/* Content sits above blur */}
      <View style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </View>
    </View>
  );

  if (!animate) return inner;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 160, delay }}
    >
      {inner}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
