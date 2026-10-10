import { useRouter } from 'expo-router';
import { Check } from '@tamagui/lucide-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { setLanguage, SupportedLang } from '../../src/lib/i18n';
import { api } from '../../src/lib/apiClient';

export default function LanguagePicker() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [lang, setLang] = useState<SupportedLang>(i18n.language as SupportedLang);
  const [busy, setBusy] = useState(false);

  async function onContinue() {
    setBusy(true);
    // Save language preference in the background — don't block navigation.
    api.put('/v1/me/profile', { preferred_language: lang }).catch(() => {});
    try {
      await setLanguage(lang);
    } catch (e) {
      console.warn('[language] setLanguage failed:', e);
    }
    // Always navigate — regardless of API or setLanguage outcome.
    router.replace('/(tabs)');
    setBusy(false);
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background" pb="$5">
        <ScreenHeader title={t('language.title')} subtitle={t('language.subtitle')} />
        <View px="$4" gap="$3" f={1}>
          <Choice label={t('language.english')} active={lang === 'en'} onPress={() => setLang('en')} />
          <Choice label={t('language.urdu')} active={lang === 'ur'} onPress={() => setLang('ur')} />
          <View mt="$8" ai="center">
            <GlowButton
              label={t('common.continue')}
              onPress={onContinue}
              disabled={busy}
              glow
              size="xl"
              fullWidth={false}
              style={{ minWidth: 220, maxWidth: 320, paddingHorizontal: 48 }}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scale={0.97}>
      <View
        fd="row"
        ai="center"
        jc="space-between"
        p="$4"
        br="$6"
        bg={active ? 'rgba(45,212,191,0.10)' : '$surface'}
        borderWidth={1.5}
        borderColor={active ? 'rgba(45,212,191,0.4)' : '$borderColor'}
        style={active ? {
          shadowColor: 'rgba(45,212,191,0.2)',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 1,
          shadowRadius: 14,
          elevation: 4,
        } as any : undefined}
      >
        <Text
          fontSize="$6"
          fontWeight="700"
          color={active ? '$primary' : '$color'}
          style={{ fontFamily: 'PlusJakartaSans_700Bold' } as any}
        >
          {label}
        </Text>
        {active ? (
          <View
            width={28}
            height={28}
            borderRadius={14}
            bg="$primary"
            ai="center"
            jc="center"
            style={{
              shadowColor: 'rgba(45,212,191,0.4)',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 1,
              shadowRadius: 8,
              elevation: 3,
            } as any}
          >
            <Check size={16} color="white" strokeWidth={2.5} />
          </View>
        ) : (
          <View
            width={28}
            height={28}
            borderRadius={14}
            bg="$surfaceMuted"
            borderWidth={1}
            borderColor="$borderColor"
          />
        )}
      </View>
    </PressableScale>
  );
}
