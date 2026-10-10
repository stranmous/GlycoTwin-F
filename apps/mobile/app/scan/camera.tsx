import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';
import { Images, X } from '@tamagui/lucide-icons';
import { MotiView } from 'moti';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { LogoMark } from '../../src/components/Logo';
import { api } from '../../src/lib/apiClient';

type Stage = 'ready' | 'capturing' | 'uploading' | 'analyzing' | 'failed';

function AnalyzingOverlay({ stage }: { stage: 'uploading' | 'analyzing' }) {
  const { t } = useTranslation();
  return (
    <View f={1} bg="#0E1726" ai="center" jc="center" gap="$5">
      {/* Pulsing mint rings */}
      <View ai="center" jc="center" width={180} height={180}>
        {[1, 2, 3].map((i) => (
          <MotiView
            key={i}
            from={{ scale: 0.6, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{
              type: 'timing',
              duration: 1800,
              loop: true,
              delay: i * 420,
            }}
            style={[StyleSheet.absoluteFillObject, styles.pulseRing]}
          />
        ))}
        <View
          width={80}
          height={80}
          borderRadius={40}
          bg="rgba(45,212,191,0.15)"
          borderWidth={2}
          borderColor="rgba(45,212,191,0.5)"
          ai="center"
          jc="center"
          style={styles.logoGlow}
        >
          <LogoMark size={44} />
        </View>
      </View>

      <MotiView
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 200 }}
      >
        <Text
          style={styles.analyzeTitle}
          color="#FFF8EA"
          ta="center"
        >
          {stage === 'uploading' ? t('scan.uploading') : t('scan.analyzing')}
        </Text>
        <Text color="rgba(186,202,197,0.7)" fontSize="$4" ta="center" mt="$1">
          GlycoTwin
        </Text>
      </MotiView>
    </View>
  );
}

export default function CameraScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>('ready');
  const [error, setError] = useState<string | null>(null);

  async function capture() {
    if (!cameraRef.current) return;
    setStage('capturing');
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo) throw new Error('No photo');
      await upload(photo.uri);
    } catch {
      setStage('failed');
    }
  }

  async function pickGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    await upload(result.assets[0].uri);
  }

  async function upload(uri: string) {
    setStage('uploading');
    try {
      const form = new FormData();
      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        const blob = await res.blob();
        form.append('image', blob, 'meal.jpg');
      } else {
        form.append('image', { uri, type: 'image/jpeg', name: 'meal.jpg' } as unknown as Blob);
      }
      setStage('analyzing');
      const meal = await api.upload('/v1/meals/image', form);
      router.replace({ pathname: '/scan/result', params: { mealId: (meal as { id: string }).id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
      setStage('failed');
    }
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0E1726' }}>
        <View f={1} ai="center" jc="center" gap="$5" px="$6" bg="#0E1726">
          <LogoMark size={120} />
          <Text
            style={[styles.analyzeTitle, { fontSize: 36, marginTop: 12, marginBottom: 12 }]}
            color="#FFF8EA"
            ta="center"
          >
            {t('scan.title')}
          </Text>
          <GlowButton label={t('scan.openCamera')} onPress={requestPermission} glow size="2xl" />
          <GlowButton
            label="Choose from Gallery"
            variant="ghost"
            onPress={pickGallery}
            size="2xl"
            icon={<Images size={20} color="white" />}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'uploading' || stage === 'analyzing') {
    return <AnalyzingOverlay stage={stage} />;
  }

  if (stage === 'failed') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0E1726' }}>
        <View f={1} ai="center" jc="center" gap="$5" px="$6" bg="#0E1726">
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring' }}
          >
            <View
              width={80}
              height={80}
              borderRadius={40}
              bg="rgba(244,63,94,0.15)"
              borderWidth={2}
              borderColor="rgba(244,63,94,0.4)"
              ai="center"
              jc="center"
            >
              <Text fontSize="$9">✕</Text>
            </View>
          </MotiView>
          <Text style={styles.analyzeTitle} color="#FFF8EA" ta="center">
            {t('scan.failedTitle')}
          </Text>
          <Text color="rgba(186,202,197,0.7)" ta="center" fontSize="$4">
            {t('scan.failedBody')}
          </Text>
          {error ? <Text color="#F43F5E" fontSize="$3">{error}</Text> : null}
          <GlowButton label={t('scan.tryAgain')} glow onPress={() => setStage('ready')} size="2xl" />
          <GlowButton label={t('common.cancel')} variant="ghost" onPress={() => router.back()} size="2xl" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View f={1} bg="black">
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Corner bracket guide — mint tint */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Top-left */}
        <View style={[styles.bracket, styles.bracketTL]} />
        {/* Top-right */}
        <View style={[styles.bracket, styles.bracketTR]} />
        {/* Bottom-left */}
        <View style={[styles.bracket, styles.bracketBL]} />
        {/* Bottom-right */}
        <View style={[styles.bracket, styles.bracketBR]} />
      </View>

      <SafeAreaView style={styles.overlay}>
        {/* Close button — glass pill */}
        <View fd="row" jc="space-between" px="$4" pt="$2">
          <PressableScale onPress={() => router.back()}>
            <View style={styles.closeBtn}>
              <X size={20} color="white" />
            </View>
          </PressableScale>
        </View>

        {/* Tip bar */}
        <View style={styles.tipBar}>
          <Text color="rgba(255,255,255,0.9)" fontSize="$3" ta="center"
            style={{ fontFamily: 'PlusJakartaSans_500Medium' }}>
            {t('scan.tip')}
          </Text>
        </View>

        {/* Controls row */}
        <View style={styles.controls}>
          {/* Gallery chip */}
          <PressableScale onPress={pickGallery} scale={0.92}>
            <View style={styles.galleryChip} fd="row" ai="center" gap="$2">
              <Images size={28} color="white" />
              <Text color="white" fontSize="$5" fontWeight="600"
                style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                Gallery
              </Text>
            </View>
          </PressableScale>

          {/* Shutter — mint gradient circle */}
          <PressableScale onPress={capture} haptic="medium" scale={0.94}>
            <View style={styles.shutterWrapper}>
              {/* Glow ring */}
              <MotiView
                from={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.15, opacity: 0.2 }}
                transition={{ type: 'timing', duration: 1400, loop: true, repeatReverse: true }}
                style={[StyleSheet.absoluteFillObject, styles.shutterGlow]}
              />
              <Svg width={80} height={80} style={StyleSheet.absoluteFillObject} viewBox="0 0 80 80">
                <Defs>
                  <LinearGradient id="shutterGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#2DD4BF" />
                    <Stop offset="1" stopColor="#0098A0" />
                  </LinearGradient>
                </Defs>
                <Circle cx="40" cy="40" r="40" fill="url(#shutterGrad)" />
              </Svg>
              {/* White border ring */}
              <View style={styles.shutterRing} />
            </View>
          </PressableScale>

          <View style={{ width: 80 }} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  closeBtn: {
    backgroundColor: 'rgba(14,23,38,0.55)',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 10,
    alignSelf: 'flex-start',
  },
  tipBar: {
    marginHorizontal: 32,
    backgroundColor: 'rgba(14,23,38,0.6)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.2)',
    padding: 12,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  galleryChip: {
    backgroundColor: 'rgba(14,23,38,0.55)',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  shutterWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(45,212,191,0.6)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 12,
  },
  shutterGlow: {
    borderRadius: 40,
    backgroundColor: 'rgba(45,212,191,0.35)',
  },
  shutterRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    top: -4,
    left: -4,
  },
  pulseRing: {
    borderRadius: 90,
    borderWidth: 2,
    borderColor: 'rgba(45,212,191,0.5)',
    backgroundColor: 'transparent',
  },
  analyzeTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    letterSpacing: -0.3,
  },
  logoGlow: {
    shadowColor: 'rgba(45,212,191,0.5)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  bracket: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: 'rgba(45,212,191,0.7)',
    borderWidth: 0,
  },
  bracketTL: {
    top: '25%',
    left: '12%',
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 6,
  },
  bracketTR: {
    top: '25%',
    right: '12%',
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 6,
  },
  bracketBL: {
    bottom: '25%',
    left: '12%',
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 6,
  },
  bracketBR: {
    bottom: '25%',
    right: '12%',
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 6,
  },
});
