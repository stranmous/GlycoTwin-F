import { Check } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';

import { PressableScale } from '../../src/components/motion/PressableScale';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useThemeStore } from '../../src/lib/themeStore';

type Pref = 'light' | 'dark' | 'system';
const OPTIONS: { value: Pref; labelKey: string }[] = [
  { value: 'light', labelKey: 'settings.themeLight' },
  { value: 'dark', labelKey: 'settings.themeDark' },
  { value: 'system', labelKey: 'settings.themeSystem' },
];

export default function ThemeSettings() {
  const { t } = useTranslation();
  const { pref, setPref } = useThemeStore();

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background">
        <ScreenHeader title={t('settings.theme')} showBack />
        <View px="$4" gap="$2">
          {OPTIONS.map((opt) => (
            <PressableScale key={opt.value} onPress={() => setPref(opt.value)} scale={0.97}>
              <View
                fd="row" ai="center" jc="space-between" p="$4" br="$4"
                bg={pref === opt.value ? '$primarySoft' : '$surface'}
                borderWidth={1}
                borderColor={pref === opt.value ? '$primary' : '$borderColor'}
              >
                <Text fontSize="$5" fontWeight="600">{t(opt.labelKey)}</Text>
                {pref === opt.value ? <Check size={20} color="$primary" /> : null}
              </View>
            </PressableScale>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
