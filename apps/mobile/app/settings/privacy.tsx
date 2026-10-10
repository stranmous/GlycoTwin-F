import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SafetyBadge } from '../../src/components/SafetyBadge';

export default function Privacy() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background">
        <ScreenHeader title={t('settings.privacy')} showBack />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <SafetyBadge label={t('safety.educationalOnly')} />
          <Text color="$color" fontSize="$5" fontWeight="700">Data & Privacy</Text>
          <Text color="$colorMuted" lineHeight={22}>
            GlycoTwin stores your profile, meal logs, predictions, and chat history on our servers to power personalised simulations and insights.
          </Text>
          <Text color="$colorMuted" lineHeight={22}>
            Your data is never sold. AI Coach messages are processed by Google Gemini under their data policy. Meal images are stored encrypted at rest.
          </Text>
          <Text color="$colorMuted" lineHeight={22}>
            This app is for educational purposes only and does not constitute medical advice.
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
