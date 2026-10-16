import { Alert, Platform, StyleSheet, View as RNView } from 'react-native';
import { Check } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme } from 'tamagui';

import { PressableScale } from '../../src/components/motion/PressableScale';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { setLanguage, SupportedLang } from '../../src/lib/i18n';
import { api } from '../../src/lib/apiClient';

export default function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const current = i18n.language as SupportedLang;

  async function pick(lang: SupportedLang) {
    await api.put('/v1/me/profile', { preferred_language: lang });
    const { needsReload } = await setLanguage(lang);
    if (needsReload) {
      Alert.alert('Restart needed', 'Language direction changed. Please relaunch the app.');
    }
  }

  const options: { value: SupportedLang; label: string; sub: string }[] = [
    { value: 'en', label: t('language.english'), sub: 'English (Left-to-Right)' },
    { value: 'ur', label: t('language.urdu'), sub: 'اردو (دائیں سے بائیں)' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <RNView style={{ flex: 1 }}>
        <ScreenHeader title={t('settings.language')} showBack />

        <RNView style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
          {options.map((opt) => {
            const active = current === opt.value;
            return (
              <PressableScale key={opt.value} onPress={() => pick(opt.value)} scale={0.98}>
                <RNView
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: theme.surface.val,
                      borderColor: active ? '#2AA89A' : theme.borderColor.val,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                >
                  <RNView style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 16, color: theme.color.val }}>
                      {opt.label}
                    </Text>
                    <Text style={{ fontFamily: 'Nunito_500Medium', fontSize: 13, color: theme.colorMuted.val }}>
                      {opt.sub}
                    </Text>
                  </RNView>

                  <RNView
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: active ? '#2AA89A' : theme.surfaceMuted.val,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {active && <Check size={16} color="#FFFFFF" />}
                  </RNView>
                </RNView>
              </PressableScale>
            );
          })}
        </RNView>
      </RNView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  optionCard: {
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' ? { boxShadow: '0 3px 10px rgba(61, 61, 61, 0.05)' } as any : {
      shadowColor: '#3D3D3D',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    }),
  },
});
