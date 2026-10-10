import { Alert } from 'react-native';
import { Check } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';

import { PressableScale } from '../../src/components/motion/PressableScale';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { setLanguage, SupportedLang } from '../../src/lib/i18n';
import { api } from '../../src/lib/apiClient';

export default function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const current = i18n.language as SupportedLang;

  async function pick(lang: SupportedLang) {
    await api.put('/v1/me/profile', { preferred_language: lang });
    const { needsReload } = await setLanguage(lang);
    if (needsReload) {
      Alert.alert('Restart needed', 'Language direction changed. Please relaunch the app.');
    }
  }

  const options: { value: SupportedLang; label: string }[] = [
    { value: 'en', label: t('language.english') },
    { value: 'ur', label: t('language.urdu') },
  ];

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background">
        <ScreenHeader title={t('settings.language')} showBack />
        <View px="$4" gap="$2">
          {options.map((opt) => (
            <PressableScale key={opt.value} onPress={() => pick(opt.value)} scale={0.97}>
              <View
                fd="row" ai="center" jc="space-between" p="$4" br="$4"
                bg={current === opt.value ? '$primarySoft' : '$surface'}
                borderWidth={1}
                borderColor={current === opt.value ? '$primary' : '$borderColor'}
              >
                <Text fontSize="$5" fontWeight="600">{opt.label}</Text>
                {current === opt.value ? <Check size={20} color="$primary" /> : null}
              </View>
            </PressableScale>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
