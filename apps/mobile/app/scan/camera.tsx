import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View as RNView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, useTheme } from 'tamagui';
import { Edit3, Images, X } from '@tamagui/lucide-icons';
import { MotiView } from 'moti';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { LogoMark } from '../../src/components/Logo';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { api } from '../../src/lib/apiClient';
import type { NutritionEstimateOut } from '../../src/types/api';

type Stage = 'ready' | 'capturing' | 'uploading' | 'analyzing' | 'failed';

function AnalyzingOverlay({ stage }: { stage: 'uploading' | 'analyzing' }) {
  const { t } = useTranslation();
  return (
    <RNView style={styles.analyzingContainer}>
      {/* Pulsing mint rings */}
      <RNView style={{ alignItems: 'center', justifyContent: 'center', width: 180, height: 180 }}>
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
        <RNView style={styles.logoGlow}>
          <LogoMark size={44} />
        </RNView>
      </RNView>

      <MotiView
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 200 }}
        style={{ alignItems: 'center' }}
      >
        <Text style={styles.analyzeTitle}>
          {stage === 'uploading' ? t('scan.uploading') : t('scan.analyzing')}
        </Text>
        <Text style={styles.analyzeSubtitle}>
          {t('scan.analysisMayTake')}
        </Text>
      </MotiView>
    </RNView>
  );
}

export default function CameraScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>('ready');
  const [error, setError] = useState<string | null>(null);
  const [dishHint, setDishHint] = useState('');

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
      if (dishHint.trim()) {
        form.append('dish_hint', dishHint.trim());
      }
      setStage('analyzing');
      const resultData = await api.upload<NutritionEstimateOut>('/api/v1/nutrition/estimate', form);

      router.replace({
        pathname: '/scan/result',
        params: {
          mealId: resultData.id || `meal-${Date.now()}`,
          dishHint: dishHint.trim(),
          estimateJson: JSON.stringify({ ...resultData, image_url: resultData?.image_url || uri }),
          imageUri: uri,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
      setStage('failed');
    }
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
        <ScreenHeader title={t('scan.title')} showBack />
        <RNView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 }}>
          <LogoMark size={92} />
          <Text
            style={[styles.analyzeTitle, { fontSize: 24, marginTop: 4, marginBottom: 4, color: theme.color.val }]}
            ta="center"
          >
            {t('scan.title')}
          </Text>
          <Text style={{ fontFamily: 'Nunito_500Medium', fontSize: 14, color: theme.colorMuted.val, textAlign: 'center', marginBottom: 8 }}>
            {t('scan.tip')}
          </Text>
          <RNView style={{ width: '100%', maxWidth: 320, gap: 12 }}>
            <RNView>
              <TextInput
                value={dishHint}
                onChangeText={setDishHint}
                placeholder={t('scan.dishHintPlaceholder')}
                placeholderTextColor={theme.colorMuted.val}
                accessibilityLabel={t('scan.dishHintPlaceholder')}
                style={[
                  styles.permissionDishHintInput,
                  { color: theme.color.val, borderColor: theme.borderColor.val },
                ]}
              />
              <Text style={[styles.permissionDishHintHelp, { color: theme.colorMuted.val }]}>
                {t('scan.dishHintHelp')}
              </Text>
            </RNView>
            <GlowButton label={t('scan.openCamera')} onPress={requestPermission} glow size="xl" />
            <GlowButton
              label={t('scan.fromGallery')}
              variant="secondary"
              onPress={pickGallery}
              size="xl"
              icon={<Images size={20} color="#2AA89A" />}
            />
            <GlowButton
              label="Log meal manually"
              variant="secondary"
              onPress={() => router.push('/scan/result?mode=manual')}
              size="xl"
              icon={<Edit3 size={20} color="#2AA89A" />}
            />
            <GlowButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => router.back()}
              size="md"
            />
          </RNView>
        </RNView>
      </SafeAreaView>
    );
  }

  if (stage === 'uploading' || stage === 'analyzing') {
    return <AnalyzingOverlay stage={stage} />;
  }

  if (stage === 'failed') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
        <RNView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24, backgroundColor: '#FFFBF5' }}>
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring' }}
          >
            <RNView
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#FFE5D9',
                borderWidth: 2,
                borderColor: '#FF8A80',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 32, color: '#FF8A80' }}>✕</Text>
            </RNView>
          </MotiView>
          <Text style={[styles.analyzeTitle, { color: '#3D3D3D' }]} ta="center">
            {t('scan.failedTitle')}
          </Text>
          <Text style={{ fontFamily: 'Nunito_500Medium', color: '#8E8E8E', textAlign: 'center', fontSize: 15 }}>
            {t('scan.failedBody')}
          </Text>
          {error ? <Text style={{ fontFamily: 'Nunito_600SemiBold', color: '#FF8A80', fontSize: 13 }}>{error}</Text> : null}
          <GlowButton label={t('scan.tryAgain')} glow onPress={() => setStage('ready')} size="xl" />
          <GlowButton label={t('common.cancel')} variant="secondary" onPress={() => router.back()} size="xl" />
        </RNView>
      </SafeAreaView>
    );
  }

  return (
    <RNView style={{ flex: 1, backgroundColor: '#000000' }}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Corner bracket guide — Warm Teal tint */}
      <RNView style={StyleSheet.absoluteFill} pointerEvents="none">
        <RNView style={[styles.bracket, styles.bracketTL]} />
        <RNView style={[styles.bracket, styles.bracketTR]} />
        <RNView style={[styles.bracket, styles.bracketBL]} />
        <RNView style={[styles.bracket, styles.bracketBR]} />
      </RNView>

      <SafeAreaView style={styles.overlay}>
        {/* Top Header Bar: Close button on left, Sidelined compact coin guidance on right */}
        <RNView style={styles.topHeader}>
          <PressableScale onPress={() => router.back()}>
            <RNView style={styles.closeBtn}>
              <X size={20} color="#FFFFFF" />
            </RNView>
          </PressableScale>

          <RNView style={styles.coinGuidancePill}>
            <Text style={{ fontSize: 13 }}>🪙</Text>
            <Text style={styles.coinGuidanceText}>
              Coin for 3D scale
            </Text>
          </RNView>
        </RNView>

        {/* Discreet instruction pill right below header, safely above reticle */}
        <RNView style={styles.tipBarWrap}>
          <RNView style={styles.tipBar}>
            <Text style={styles.tipText}>
              {t('scan.tip')}
            </Text>
          </RNView>
        </RNView>

        {/* Empty middle spacer so the viewfinder area is 100% clear for the plate */}
        <RNView style={{ flex: 1 }} pointerEvents="none" />

        {/* Bottom Section: Dish Hint input docked right above shutter controls */}
        <RNView style={styles.bottomSection}>
          <RNView style={styles.dishHintContainer}>
            <TextInput
              value={dishHint}
              onChangeText={setDishHint}
              placeholder="Dish name for estimate (e.g. Biryani, Daal, Roti)"
              placeholderTextColor="rgba(255, 255, 255, 0.65)"
              style={styles.dishHintInput}
            />
          </RNView>

          {/* Controls row: Gallery circular icon button on left, Shutter centered, symmetric spacer on right */}
          <RNView style={styles.controls}>
            {/* Gallery Circular Button (icon only, no jumbled text) */}
            <PressableScale onPress={pickGallery} scale={0.92} accessibilityLabel="Choose from gallery">
              <RNView style={styles.galleryCircleBtn}>
                <Images size={24} color="#FFFFFF" strokeWidth={2.2} />
              </RNView>
            </PressableScale>

            {/* Shutter — 80px Warm Teal circular button */}
            <PressableScale onPress={capture} scale={0.94} accessibilityLabel="Take photo">
              <RNView style={styles.shutterWrapper}>
                <MotiView
                  from={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.15, opacity: 0.15 }}
                  transition={{ type: 'timing', duration: 1400, loop: true, repeatReverse: true }}
                  style={[StyleSheet.absoluteFillObject, styles.shutterGlow]}
                />
                <Svg width={80} height={80} style={StyleSheet.absoluteFillObject} viewBox="0 0 80 80">
                  <Defs>
                    <LinearGradient id="warmShutterGrad" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor="#2AA89A" />
                      <Stop offset="1" stopColor="#006A61" />
                    </LinearGradient>
                  </Defs>
                  <Circle cx="40" cy="40" r="40" fill="url(#warmShutterGrad)" />
                </Svg>
                <RNView style={styles.shutterRing} />
              </RNView>
            </PressableScale>

            {/* Manual Log Circular Button on right, perfectly balancing Gallery on left */}
            <PressableScale onPress={() => router.push('/scan/result?mode=manual')} scale={0.92} accessibilityLabel="Log meal manually">
              <RNView style={styles.galleryCircleBtn}>
                <Edit3 size={24} color="#FFFFFF" strokeWidth={2.2} />
              </RNView>
            </PressableScale>
          </RNView>
        </RNView>
      </SafeAreaView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  analyzingContainer: {
    flex: 1,
    backgroundColor: '#FFFBF5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinGuidancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 9999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 71, 0.5)',
  },
  coinGuidanceText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#FFE5D9',
  },
  tipBarWrap: {
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  tipBar: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  tipText: {
    fontFamily: 'Nunito_600SemiBold',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    textAlign: 'center',
  },
  bottomSection: {
    paddingBottom: Platform.OS === 'ios' ? 20 : 32,
    gap: 14,
  },
  dishHintContainer: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(42, 168, 154, 0.45)',
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
  },
  dishHintInput: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
    height: '100%',
    padding: 0,
  },
  permissionDishHintInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
  },
  permissionDishHintHelp: {
    marginTop: 6,
    fontFamily: 'Nunito_500Medium',
    fontSize: 12,
    lineHeight: 17,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  galleryCircleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsSpacer: {
    width: 52,
    height: 52,
  },
  shutterWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(42, 168, 154, 0.45)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 12,
  },
  shutterGlow: {
    borderRadius: 40,
    backgroundColor: 'rgba(42, 168, 154, 0.35)',
  },
  shutterRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    top: -4,
    left: -4,
  },
  pulseRing: {
    borderRadius: 90,
    borderWidth: 2,
    borderColor: '#81C995',
    backgroundColor: 'transparent',
  },
  analyzeTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: '#3D3D3D',
  },
  analyzeSubtitle: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: '#8E8E8E',
    marginTop: 4,
  },
  logoGlow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D4F5E9',
    borderWidth: 2,
    borderColor: '#81C995',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(42, 168, 154, 0.3)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 6,
  },
  bracket: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: '#2AA89A',
    borderWidth: 0,
  },
  bracketTL: {
    top: '25%',
    left: '12%',
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 10,
  },
  bracketTR: {
    top: '25%',
    right: '12%',
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 10,
  },
  bracketBL: {
    bottom: '25%',
    left: '12%',
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 10,
  },
  bracketBR: {
    bottom: '25%',
    right: '12%',
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 10,
  },
});
