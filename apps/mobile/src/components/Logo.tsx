import React from 'react';
import { Text, View } from 'tamagui';
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg';

// The real GlycoTwin icon — two interlocking loops + glucose waveform + data nodes
export function LogoMark({ size = 40 }: { size?: number }) {
  const scale = size / 650;
  const id = React.useId().replace(/:/g, '');
  
  return (
    <Svg width={size} height={size} viewBox="0 0 650 650" fill="none">
      <Defs>
        <LinearGradient id={`lm0-${id}`} x1="125.938" y1="158.437" x2="524.063" y2="491.562" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#62F4F1" />
          <Stop offset="0.56" stopColor="#A7FF3F" />
          <Stop offset="1" stopColor="#FFB24C" />
        </LinearGradient>
        <LinearGradient id={`lm1-${id}`} x1="125.938" y1="158.437" x2="524.062" y2="491.562" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#62F4F1" />
          <Stop offset="0.56" stopColor="#A7FF3F" />
          <Stop offset="1" stopColor="#FFB24C" />
        </LinearGradient>
        <LinearGradient id={`lm2-${id}`} x1="138.125" y1="251.875" x2="511.875" y2="416.406" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#62F4F1" />
          <Stop offset="1" stopColor="#A7FF3F" />
        </LinearGradient>
      </Defs>
      {/* Shadow loops */}
      <Path
        d="M188.906 369.687C123.906 310.781 136.094 205.156 227.5 158.437C322.969 109.687 424.531 152.344 444.844 249.844C463.125 353.437 361.563 414.375 270.156 381.875C225.469 365.625 197.031 333.125 195 294.531"
        stroke="#26314D" strokeOpacity="0.7" strokeWidth="44.6875" strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M461.094 280.312C526.094 339.219 513.906 444.844 422.5 491.562C327.031 540.312 225.469 497.656 205.156 400.156C186.875 296.562 288.438 235.625 379.844 268.125C424.531 284.375 452.969 316.875 455 355.469"
        stroke="#26314D" strokeOpacity="0.7" strokeWidth="44.6875" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Gradient loops */}
      <Path
        d="M188.906 369.687C123.906 310.781 136.094 205.156 227.5 158.437C322.969 109.687 424.531 152.344 444.844 249.844C463.125 353.437 361.563 414.375 270.156 381.875C225.469 365.625 197.031 333.125 195 294.531"
        stroke={`url(#lm0-${id})`} strokeWidth="26.4062" strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M461.094 280.312C526.094 339.219 513.906 444.844 422.5 491.562C327.031 540.312 225.469 497.656 205.156 400.156C186.875 296.562 288.438 235.625 379.844 268.125C424.531 284.375 452.969 316.875 455 355.469"
        stroke={`url(#lm1-${id})`} strokeWidth="26.4062" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Glucose waveform dark base */}
      <Path
        d="M142.188 333.125C190.938 333.125 211.25 333.125 235.625 333.125C268.125 333.125 264.062 249.844 300.625 249.844C339.219 249.844 337.188 416.406 375.781 416.406C412.344 416.406 406.25 333.125 438.75 333.125C465.156 333.125 481.406 333.125 511.875 333.125"
        stroke="#050914" strokeWidth="42.6562" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Glucose waveform gradient */}
      <Path
        d="M142.188 333.125C190.938 333.125 211.25 333.125 235.625 333.125C268.125 333.125 264.062 249.844 300.625 249.844C339.219 249.844 337.188 416.406 375.781 416.406C412.344 416.406 406.25 333.125 438.75 333.125C465.156 333.125 481.406 333.125 511.875 333.125"
        stroke={`url(#lm2-${id})`} strokeWidth="16.25" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Corner brackets */}
      <Path
        d="M172.656 223.438V178.75H221.406M477.344 223.438V178.75H428.594M172.656 426.562V471.25H221.406M477.344 426.562V471.25H428.594"
        stroke="#FFF8EA" strokeOpacity="0.66" strokeWidth="14.2188" strokeLinecap="round"
      />
      {/* Trough node — cyan */}
      <Circle cx="300.625" cy="249.844" r="26.406" fill="#050914" />
      <Circle cx="300.625" cy="249.844" r="16.25" fill="#62F4F1" />
      {/* Peak node — lime */}
      <Circle cx="375.781" cy="416.406" r="26.406" fill="#050914" />
      <Circle cx="375.781" cy="416.406" r="16.25" fill="#A7FF3F" />
      {/* Baseline node — amber */}
      <Circle cx="455" cy="333.125" r="30.469" fill="#050914" />
      <Circle cx="455" cy="333.125" r="18.281" fill="#FFB24C" />
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
  const textColor = light ? '#FFF8EA' : '$color';
  const accentColor = '#2DD4BF';

  return (
    <View fd="row" ai="center" gap="$2">
      <LogoMark size={size} />
      <Text
        style={{
          fontFamily: 'PlusJakartaSans_800ExtraBold',
          fontSize: size * 0.56,
          letterSpacing: -0.5,
          color: light ? '#FFF8EA' : undefined,
        }}
        color={light ? undefined : '$color'}
      >
        Glyco
        <Text
          style={{
            fontFamily: 'PlusJakartaSans_800ExtraBold',
            color: accentColor,
          }}
        >
          Twin
        </Text>
      </Text>
    </View>
  );
}
