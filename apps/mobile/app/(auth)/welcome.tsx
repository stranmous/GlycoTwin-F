import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, ScrollView, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'tamagui';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { LogoMark } from '../../src/components/Logo';

function AmbientOrb({
  size, left, top, color, delay,
}: { size: number; left: string | number; top: string | number; color: string; delay: number }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(0.25);
  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-16, { duration: 3400 + delay }),
        withTiming(0, { duration: 3400 + delay }),
      ),
      -1,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 2600 + delay }),
        withTiming(0.2, { duration: 2600 + delay }),
      ),
      -1,
    );
  }, [delay, opacity, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          pointerEvents: 'none',
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          left: left as DimensionValue,
          top: top as DimensionValue,
        },
        style,
      ]}
    />
  );
}

export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      {/* Soft Floating Ambient Pastel Orbs */}
      <AmbientOrb size={190} left="-10%" top="2%" color="rgba(255,229,217,0.55)" delay={0} />
      <AmbientOrb size={170} left="65%" top="22%" color="rgba(212,245,233,0.45)" delay={600} />
      <AmbientOrb size={140} left="10%" top="55%" color="rgba(255,243,205,0.45)" delay={1200} />

      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header: Logo, Wordmark & Tagline */}
          <MotiView
            from={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 16, stiffness: 140, delay: 60 }}
            style={styles.logoArea}
          >
            <View style={styles.logoBadge}>
              <LogoMark size={56} />
            </View>
            <Text style={styles.wordmark}>
              Glyco<Text style={styles.wordmarkAccent}>Twin</Text>
            </Text>
            <Text style={styles.wordmarkSub}>
              {t('auth.welcomeBody') || 'Understand your meals. Master your glucose.'}
            </Text>
          </MotiView>

          {/* Editorial Card: Warm, Reassuring & Human */}
          <MotiView
            from={{ opacity: 0, translateY: 18 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: 200, damping: 18, stiffness: 130 }}
            style={styles.editorialCard}
          >
            {/* Top edge warm gradient bar */}
            <View style={styles.cardAccentBar} />

            {/* Friendly Non-Clinical Pill Tag */}
            <View style={styles.tagPill}>
              <Text style={styles.tagPillText}>✨ Friendly & Non-Clinical</Text>
            </View>

            {/* Headline */}
            <Text style={styles.cardHeading}>
              A gentler way to live with diabetes 👋
            </Text>

            {/* Feature Highlights */}
            <View style={styles.featuresList}>
              {/* Feature 1 */}
              <View style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: '#FFE5D9' }]}>
                  <Text style={styles.emojiText}>📸</Text>
                </View>
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>Snap your plate</Text>
                  <Text style={styles.featureBody}>
                    Instant South Asian carb & fiber estimates tailored to rotis, dals, and curries.
                  </Text>
                </View>
              </View>

              {/* Feature 2 */}
              <View style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: '#D4F5E9' }]}>
                  <Text style={styles.emojiText}>📈</Text>
                </View>
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>Predictive glucose curves</Text>
                  <Text style={styles.featureBody}>
                    Visualize 4-hour curves and see how a gentle 15-min walk flattens the spike.
                  </Text>
                </View>
              </View>

              {/* Feature 3 */}
              <View style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: '#FFF3CD' }]}>
                  <Text style={styles.emojiText}>🤖</Text>
                </View>
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>Friendly AI companion</Text>
                  <Text style={styles.featureBody}>
                    Personal guidance with warm, clear steps — zero medical jargon or guilt.
                  </Text>
                </View>
              </View>
            </View>

            {/* Educational Disclaimer Micro-Badge */}
            <View style={styles.disclaimerPill}>
              <Text style={styles.disclaimerText}>
                🛡️ Educational guidance only • Always consult your doctor
              </Text>
            </View>
          </MotiView>

          {/* Bottom Action Buttons */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: 350 }}
            style={styles.actions}
          >
            <GlowButton
              label={t('auth.getStarted')}
              glow
              size="xl"
              onPress={() => router.push('/(auth)/signup')}
            />
            <View style={{ marginTop: 12 }}>
              <GlowButton
                label={t('auth.haveAccount')}
                variant="secondary"
                size="xl"
                onPress={() => router.push('/(auth)/login')}
              />
            </View>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  logoArea: {
    marginTop: 18,
    marginBottom: 20,
    alignItems: 'center',
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2AA89A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
    marginBottom: 12,
  },
  wordmark: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    color: '#3D3D3D',
    letterSpacing: -0.5,
  },
  wordmarkAccent: {
    color: '#2AA89A',
  },
  wordmarkSub: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 14,
    color: '#8E8E8E',
    textAlign: 'center',
    maxWidth: 290,
    marginTop: 6,
    lineHeight: 20,
  },
  editorialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
    shadowColor: '#3D3D3D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#2AA89A',
  },
  tagPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EAF7EE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    marginBottom: 12,
  },
  tagPillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#236B40',
  },
  cardHeading: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: '#3D3D3D',
    lineHeight: 26,
    marginBottom: 16,
  },
  featuresList: {
    gap: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 18,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: '#3D3D3D',
    marginBottom: 2,
  },
  featureBody: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: '#8E8E8E',
    lineHeight: 18,
  },
  disclaimerPill: {
    marginTop: 18,
    backgroundColor: '#FFF5EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  disclaimerText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    color: '#3D3D3D',
  },
  actions: {
    paddingBottom: 16,
  },
});
