import React from 'react';
import { Text, View } from 'tamagui';
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg';

// The Warm Companion GlycoTwin icon — interlocking loops + glucose waveform + warm teal/sage/amber gradient
export function LogoMark({ size = 48 }: { size?: number }) {
  const id = React.useId().replace(/:/g, '');

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id={`lg-${id}`} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#2AA89A" />
          <Stop offset="0.55" stopColor="#81C995" />
          <Stop offset="1" stopColor="#FFB347" />
        </LinearGradient>
      </Defs>
      {/* Interlocking Harmonious Loops (Infinity / Dual Twin Arc) */}
      <Path
        d="M22 24C17.5817 24 14 27.5817 14 32C14 36.4183 17.5817 40 22 40C27.5 40 31 34 32 32C33 30 36.5 24 42 24C46.4183 24 50 27.5817 50 32C50 36.4183 46.4183 40 42 40"
        opacity={0.35}
        stroke={`url(#lg-${id})`}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dynamic Glucose Wave Curve Overlaid */}
      <Path
        d="M14 33C18 33 21 21 27 21C32 21 34 43 39 43C43 43 46 29 50 30"
        stroke={`url(#lg-${id})`}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Peak / Valley Node Markers */}
      <Circle cx={27} cy={21} r={3.2} fill="#FFB347" />
      <Circle cx={39} cy={43} r={2.8} fill="#2AA89A" />
    </Svg>
  );
}

export function LogoLockup({
  size = 36,
  light = false,
}: {
  size?: number;
  light?: boolean;
}) {
  const textColor = light ? '#FFF8EA' : '#3D3D3D';
  const accentColor = '#2AA89A';

  return (
    <View fd="row" ai="center" gap="$2">
      <LogoMark size={size} />
      <Text
        style={{
          fontFamily: 'Nunito_800ExtraBold',
          fontSize: size * 0.62,
          letterSpacing: -0.5,
          color: light ? '#FFF8EA' : undefined,
        }}
        color={light ? undefined : '$color'}
      >
        Glyco
        <Text
          style={{
            fontFamily: 'Nunito_800ExtraBold',
            color: accentColor,
          }}
        >
          Twin
        </Text>
      </Text>
    </View>
  );
}
