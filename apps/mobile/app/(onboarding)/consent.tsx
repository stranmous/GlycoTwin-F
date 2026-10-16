import { useRouter } from 'expo-router';
import { Check } from '@tamagui/lucide-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'tamagui';
import { MotiView } from 'moti';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { OnboardingProgressBar } from '../../src/components/OnboardingProgressBar';

export default function Consent() {
  const { t } = useTranslation();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1 of 4 Segmented Progress Bar */}
        <OnboardingProgressBar step={1} />

        {/* Safety Disclaimer Micro-Badge */}
        <View style={styles.badgeRow}>
          <Text style={{ fontSize: 13 }}>🛡️</Text>
          <Text style={styles.badgeText}>Educational simulation only</Text>
        </View>

        {/* Heading & Subtitle */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18 }}
        >
          <Text style={styles.title}>
            {t('consent.title', { defaultValue: 'Before we begin' })}{' '}
            <Text style={{ fontSize: 24 }}>🤝</Text>
          </Text>
          <Text style={styles.subtitle}>
            {t('consent.body', {
              defaultValue:
                'Your health and safety come first. Please review our commitments to you and your metabolic journey.',
            })}
          </Text>
        </MotiView>

        {/* Warm Peach Illustration Banner */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18, delay: 100 }}
          style={styles.bannerCard}
        >
          <View style={styles.bannerIcon}>
            <Text style={{ fontSize: 24 }}>🌿</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Metabolic Wellness Care</Text>
            <Text style={styles.bannerSub}>
              Designed to empower your daily lifestyle choices safely.
            </Text>
          </View>
        </MotiView>

        {/* Safety Commitments List Card */}
        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18, delay: 160 }}
          style={styles.pledgeCard}
        >
          <Text style={styles.pledgeHeading}>Our Safety Pledge</Text>

          <View style={styles.pledgeList}>
            <View style={styles.pledgeItem}>
              <View style={styles.checkCircle}>
                <Check size={14} color="#236B40" strokeWidth={3} />
              </View>
              <Text style={styles.pledgeText}>
                <Text style={{ fontWeight: '700', color: '#3D3D3D' }}>GlycoTwin</Text> provides
                educational insights and meal simulations only.
              </Text>
            </View>

            <View style={styles.pledgeItem}>
              <View style={styles.checkCircle}>
                <Check size={14} color="#236B40" strokeWidth={3} />
              </View>
              <Text style={styles.pledgeText}>
                It never diagnoses medical conditions or prescribes insulin or medication doses.
              </Text>
            </View>

            <View style={styles.pledgeItem}>
              <View style={styles.checkCircle}>
                <Check size={14} color="#236B40" strokeWidth={3} />
              </View>
              <Text style={styles.pledgeText}>
                Always consult a qualified physician or endocrinologist before modifying treatment.
              </Text>
            </View>

            <View style={styles.pledgeItem}>
              <View style={styles.checkCircle}>
                <Check size={14} color="#236B40" strokeWidth={3} />
              </View>
              <Text style={styles.pledgeText}>
                In any medical emergency, please dial your local emergency services immediately.
              </Text>
            </View>
          </View>
        </MotiView>

        {/* Interactive Agreement Toggle Card */}
        <PressableScale
          onPress={() => setAgreed((x) => !x)}
          haptic="light"
          scale={0.98}
          style={{ width: '100%', marginBottom: 24 }}
        >
          <View
            style={[
              styles.agreementCard,
              agreed && styles.agreementCardChecked,
            ]}
          >
            <View
              style={[
                styles.checkboxBox,
                agreed && styles.checkboxBoxChecked,
              ]}
            >
              {agreed ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.agreementText}>
                {t('consent.checkbox', {
                  defaultValue: 'I understand this app is for informational purposes only.',
                })}
              </Text>
              <Text style={styles.agreementSub}>Tap to confirm your consent</Text>
            </View>
          </View>
        </PressableScale>

        {/* Continue Button */}
        <View style={{ alignItems: 'center', paddingBottom: 24 }}>
          <GlowButton
            label={t('consent.agree', { defaultValue: 'I Agree & Continue' })}
            disabled={!agreed}
            glow={agreed}
            size="xl"
            onPress={() => router.push('/(onboarding)/profile')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#3D3D3D',
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 26,
    color: '#3D3D3D',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 14,
    color: '#8E8E8E',
    lineHeight: 20,
    marginBottom: 16,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,229,217,0.6)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(61,61,61,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  bannerTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: '#006A61',
    marginBottom: 2,
  },
  bannerSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#3D3D3D',
  },
  pledgeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
    shadowColor: 'rgba(61,61,61,0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 18,
  },
  pledgeHeading: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: '#3D3D3D',
    marginBottom: 14,
  },
  pledgeList: {
    gap: 12,
  },
  pledgeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D4F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  pledgeText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: '#3D3D3D',
    lineHeight: 19,
    flex: 1,
  },
  agreementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF5EB',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(61,61,61,0.08)',
  },
  agreementCardChecked: {
    backgroundColor: '#D4F5E9',
    borderColor: '#2AA89A',
  },
  checkboxBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(61,61,61,0.2)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#2AA89A',
    borderColor: '#2AA89A',
  },
  agreementText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: '#3D3D3D',
    lineHeight: 18,
  },
  agreementSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: '#8E8E8E',
    marginTop: 2,
  },
});
