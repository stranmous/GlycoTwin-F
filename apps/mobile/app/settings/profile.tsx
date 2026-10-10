import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { api } from '../../src/lib/apiClient';
import type { UserOut } from '../../src/types/api';

export default function ProfileSettings() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user } = useQuery<UserOut>({
    queryKey: ['me'],
    queryFn: () => api.get('/v1/me'),
  });

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background">
        <ScreenHeader title={t('settings.profile')} showBack />
        <View px="$4" gap="$3">
          {user ? (
            <>
              <Row label="Name" value={user.display_name ?? '—'} />
              <Row label={t('auth.email')} value={user.email} />
              <Row label={t('profile.age')} value={user.age ? String(user.age) : '—'} />
              <Row label={t('profile.sex')} value={user.sex ?? '—'} />
              <Row label={t('profile.weightKg')} value={user.weight_kg ? `${user.weight_kg} kg` : '—'} />
              <Row label={t('profile.diabetesType')} value={user.diabetes_type ?? '—'} />
            </>
          ) : null}
          <View mt="$4">
            <GlowButton
              label={t('common.edit')}
              variant="primary"
              glow
              size="xl"
              onPress={() => router.push('/(onboarding)/profile?mode=edit')}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View fd="row" jc="space-between" py="$3" borderBottomWidth={1} borderColor="$borderColor">
      <Text color="$colorMuted">{label}</Text>
      <Text fontWeight="600">{value}</Text>
    </View>
  );
}
