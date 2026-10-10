import { useRouter } from 'expo-router';
import { Check } from '@tamagui/lucide-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { SafetyBadge } from '../../src/components/SafetyBadge';

export default function Consent() {
  const { t } = useTranslation();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background">
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 32, gap: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <SafetyBadge label={t('safety.educationalOnly')} />
          <Text fontSize="$10" fontWeight="700">{t('consent.title')}</Text>
          <Text fontSize="$6" color="$colorMuted" lineHeight={28}>{t('consent.body')}</Text>

          <PressableScale onPress={() => setAgreed((x) => !x)} haptic="light" scale={0.97} style={{ width: '100%' }}>
            <View
              fd="row"
              ai="center"
              gap="$3"
              p="$5"
              br="$6"
              bg={agreed ? 'rgba(45,212,191,0.10)' : '$surfaceMuted'}
              borderWidth={1.5}
              borderColor={agreed ? 'rgba(45,212,191,0.4)' : '$borderColor'}
              style={agreed ? {
                shadowColor: 'rgba(45,212,191,0.2)',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 12,
                elevation: 3,
              } : undefined}
            >
              <View
                width={28}
                height={28}
                borderRadius={14}
                bg={agreed ? '$primary' : '$surface'}
                borderWidth={1.5}
                borderColor={agreed ? '$primary' : '$borderColor'}
                ai="center"
                jc="center"
              >
                {agreed ? <Check size={16} color="white" strokeWidth={3} /> : null}
              </View>
              <Text flex={1} color="$color" fontWeight="600" fontSize="$5" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' } as any}>{t('consent.checkbox')}</Text>
            </View>
          </PressableScale>

          <View mt="$6" ai="center">
            <GlowButton
              label={t('consent.agree')}
              disabled={!agreed}
              glow={agreed}
              size="xl"
              fullWidth={false}
              style={{ minWidth: 220, maxWidth: 320, paddingHorizontal: 48 }}
              onPress={() => router.push('/(onboarding)/profile')}
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
