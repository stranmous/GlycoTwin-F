import { Platform, StyleSheet, View as RNView } from 'react-native';
import { Check } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme } from 'tamagui';

import { PressableScale } from '../../src/components/motion/PressableScale';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useThemeStore } from '../../src/lib/themeStore';

type Pref = 'light' | 'dark' | 'system';
const OPTIONS: { value: Pref; labelKey: string; sub: string }[] = [
  { value: 'light', labelKey: 'settings.themeLight', sub: 'Warm cream canvas & oat tones' },
  { value: 'dark', labelKey: 'settings.themeDark', sub: 'Deep espresso & comforting shadows' },
  { value: 'system', labelKey: 'settings.themeSystem', sub: 'Match device system preference' },
];

export default function ThemeSettings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { pref, setPref } = useThemeStore();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <RNView style={{ flex: 1 }}>
        <ScreenHeader title={t('settings.theme')} showBack />

        <RNView style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
          {OPTIONS.map((opt) => {
            const active = pref === opt.value;
            return (
              <PressableScale key={opt.value} onPress={() => setPref(opt.value)} scale={0.98}>
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
                      {t(opt.labelKey)}
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
