import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View as RNView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme } from 'tamagui';
import { ShieldCheck } from '@tamagui/lucide-icons';

import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SafetyBadge } from '../../src/components/SafetyBadge';

export default function Privacy() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <RNView style={{ flex: 1 }}>
        <ScreenHeader title={t('settings.privacy')} showBack />

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <RNView style={{ alignSelf: 'flex-start' }}>
            <SafetyBadge label={t('safety.educationalOnly')} />
          </RNView>

          <RNView
            style={[
              styles.card,
              {
                backgroundColor: theme.surface.val,
                borderColor: theme.borderColor.val,
              },
            ]}
          >
            <RNView style={styles.badgeRow}>
              <RNView style={styles.iconCircle}>
                <ShieldCheck size={20} color="#006A61" />
              </RNView>
              <Text style={[styles.cardTitle, { color: theme.color.val }]}>
                Data & Privacy Commitment
              </Text>
            </RNView>

            <Text style={[styles.paragraph, { color: theme.colorMuted.val }]}>
              GlycoTwin stores your profile, meal logs, predictions, and chat history on our secure servers to power personalized metabolic simulations and insights.
            </Text>

            <Text style={[styles.paragraph, { color: theme.colorMuted.val }]}>
              Your data is never sold. AI Coach interactions are processed safely by Google Gemini under strict privacy protocols. Meal images are stored encrypted at rest.
            </Text>

            <Text style={[styles.paragraph, { color: theme.colorMuted.val }]}>
              This application is designed solely for metabolic wellness education and self-monitoring. It does not constitute medical diagnosis or therapy adjustment advice.
            </Text>
          </RNView>
        </ScrollView>
      </RNView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    ...(Platform.OS === 'web' ? { boxShadow: '0 3px 10px rgba(61, 61, 61, 0.05)' } as any : {
      shadowColor: '#3D3D3D',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    }),
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D4F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
  },
  paragraph: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 14,
    lineHeight: 22,
  },
});
