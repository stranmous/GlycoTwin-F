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
import { setLanguage, SupportedLang } from '../../src/lib/i18n';
import { api } from '../../src/lib/apiClient';

export default function LanguagePicker() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [lang, setLang] = useState<SupportedLang>((i18n.language as SupportedLang) || 'en');
  const [busy, setBusy] = useState(false);

  async function onContinue() {
    setBusy(true);
    api.put('/v1/me/profile', { preferred_language: lang }).catch(() => {});
    try {
      await setLanguage(lang);
    } catch (e) {
      console.warn('[language] setLanguage failed:', e);
    }
    router.replace('/(tabs)');
    setBusy(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 4 of 4 Final Step */}
        <OnboardingProgressBar step={4} />

        {/* Header Card */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18 }}
          style={styles.headerCard}
        >
          <View style={styles.badgeRow}>
            <View style={styles.badgePill}>
              <Text style={{ fontSize: 13 }}>🌐</Text>
              <Text style={styles.badgePillText}>Bilingual Wellness</Text>
            </View>
          </View>
          <Text style={styles.title}>
            {t('language.title', { defaultValue: 'Choose your language' })}{' '}
            <Text style={{ fontSize: 24 }}>🌍</Text>
          </Text>
          <Text style={styles.subtitle}>
            {t('language.subtitle', {
              defaultValue: 'You can switch between English and Urdu anytime in Settings.',
            })}
          </Text>
        </MotiView>

        {/* Language Options */}
        <View style={styles.optionsList}>
          {/* English */}
          <PressableScale onPress={() => setLang('en')} scale={0.98}>
            <View
              style={[
                styles.choiceCard,
                lang === 'en' && styles.choiceCardActive,
              ]}
            >
              <View style={styles.choiceLeft}>
                <View
                  style={[
                    styles.langBadge,
                    lang === 'en' && styles.langBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.langBadgeText,
                      lang === 'en' && styles.langBadgeTextActive,
                    ]}
                  >
                    EN
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.choiceTitle,
                      lang === 'en' && styles.choiceTitleActive,
                    ]}
                  >
                    English
                  </Text>
                  <Text style={styles.choiceSub}>Left-to-right (LTR)</Text>
                </View>
              </View>

              <View
                style={[
                  styles.checkCircle,
                  lang === 'en' && styles.checkCircleActive,
                ]}
              >
                {lang === 'en' ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </View>
          </PressableScale>

          {/* Urdu */}
          <PressableScale onPress={() => setLang('ur')} scale={0.98}>
            <View
              style={[
                styles.choiceCard,
                lang === 'ur' && styles.choiceCardActive,
              ]}
            >
              <View style={styles.choiceLeft}>
                <View
                  style={[
                    styles.langBadge,
                    lang === 'ur' && styles.langBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.langBadgeText,
                      lang === 'ur' && styles.langBadgeTextActive,
                    ]}
                  >
                    UR
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.choiceTitle,
                      lang === 'ur' && styles.choiceTitleActive,
                    ]}
                  >
                    اردو (Urdu)
                  </Text>
                  <Text style={styles.choiceSub}>دائیں سے بائیں (RTL)</Text>
                </View>
              </View>

              <View
                style={[
                  styles.checkCircle,
                  lang === 'ur' && styles.checkCircleActive,
                ]}
              >
                {lang === 'ur' ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </View>
          </PressableScale>
        </View>

        {/* Culturally Nuanced Care Banner */}
        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18, delay: 180 }}
          style={styles.culturalCard}
        >
          <View style={styles.culturalIcon}>
            <Text style={{ fontSize: 20 }}>🫓</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.culturalTitle}>Culturally Nuanced Care</Text>
            <Text style={styles.culturalText}>
              GlycoTwin is tailored for South Asian meals in both English and Urdu. Carb estimates, rotis, and dal analytics remain accurate and identical.
            </Text>
          </View>
        </MotiView>

        {/* Action Button */}
        <View style={{ paddingTop: 32, paddingBottom: 24, alignItems: 'center' }}>
          <GlowButton
            label={t('common.continue', { defaultValue: 'Complete Setup' })}
            glow
            size="xl"
            disabled={busy}
            onPress={onContinue}
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
    paddingBottom: 32,
  },
  headerCard: {
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
    marginBottom: 20,
  },
  badgeRow: {
    marginBottom: 10,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  badgePillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#3D3D3D',
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 24,
    color: '#3D3D3D',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 13,
    color: '#8E8E8E',
    lineHeight: 19,
  },
  optionsList: {
    gap: 12,
    marginBottom: 20,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(61,61,61,0.08)',
    shadowColor: 'rgba(61,61,61,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  choiceCardActive: {
    backgroundColor: '#D4F5E9',
    borderColor: '#2AA89A',
  },
  choiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  langBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBadgeActive: {
    backgroundColor: '#2AA89A',
  },
  langBadgeText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 14,
    color: '#8E8E8E',
  },
  langBadgeTextActive: {
    color: '#FFFFFF',
  },
  choiceTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: '#3D3D3D',
    marginBottom: 2,
  },
  choiceTitleActive: {
    color: '#006A61',
  },
  choiceSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#8E8E8E',
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF5EB',
    borderWidth: 1.5,
    borderColor: 'rgba(61,61,61,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: '#2AA89A',
    borderColor: '#2AA89A',
  },
  culturalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255,229,217,0.7)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
  },
  culturalIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(61,61,61,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  culturalTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: '#3D3D3D',
    marginBottom: 2,
  },
  culturalText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#3D3D3D',
    lineHeight: 17,
  },
});
