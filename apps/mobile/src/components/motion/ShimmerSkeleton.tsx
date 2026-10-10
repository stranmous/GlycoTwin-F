import { useEffect } from 'react';
import { View } from 'tamagui';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  height?: number;
  width?: number | string;
  radius?: number;
};

export function ShimmerSkeleton({ height = 16, width = '100%', radius = 8 }: Props) {
  const x = useSharedValue(-1);

  useEffect(() => {
    x.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [x]);

  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * 200 }],
  }));

  return (
    <View
      bg="$surfaceMuted"
      br={radius}
      overflow="hidden"
      width={width as any}
      height={height}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 80,
            backgroundColor: 'rgba(255,255,255,0.35)',
          },
          sweep,
        ]}
      />
    </View>
  );
}
