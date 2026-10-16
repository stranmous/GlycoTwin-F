import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View as RNView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme } from 'tamagui';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { api } from '../../src/lib/apiClient';
import { useAuthStore } from '../../src/lib/authStore';
import type { UserOut } from '../../src/types/api';

export default function ProfileSettings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { uid } = useAuthStore();
  const { data: user } = useQuery<UserOut>({
    queryKey: ['me', uid],
    queryFn: () => api.get('/api/v1/auth/profile'),
  });

  function formatSex(sex?: string | null) {
    if (!sex) return '—';
    const map: Record<string, string> = {
      male: t('profile.sexMale'),
      female: t('profile.sexFemale'),
      other: t('profile.sexOther'),
    };
    return map[sex.toLowerCase()] ?? sex;
  }

  function formatDiabetesType(dt?: string | null) {
    if (!dt) return '—';
    const map: Record<string, string> = {
      type1: t('profile.type1'),
      type2: t('profile.type2'),
      gestational: t('profile.gestational'),
      prediabetes: t('profile.prediabetes'),
      none: t('profile.none'),
    };
    return map[dt.toLowerCase()] ?? dt;
  }

  const displayEmail = user?.email
    ? user.email.split('@').length > 2
      ? user.email.replace(/@dev\.local$/, '')
      : user.email
    : '—';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <RNView style={{ flex: 1 }}>
        <ScreenHeader title={t('settings.profile')} showBack />

        <RNView style={{ paddingHorizontal: 16, paddingTop: 8, gap: 16 }}>
          {user ? (
            <RNView
              style={[
                styles.card,
                {
                  backgroundColor: theme.surface.val,
                  borderColor: theme.borderColor.val,
                },
              ]}
            >
              <ProfileRow label="Name" value={user.display_name ?? '—'} />
              <ProfileRow label={t('auth.email')} value={displayEmail} />
              <ProfileRow label={t('profile.age')} value={user.age ? String(user.age) : '—'} />
              <ProfileRow label={t('profile.sex')} value={formatSex(user.sex)} />
              <ProfileRow label={t('profile.weightKg')} value={user.weight_kg ? `\u200E${user.weight_kg} kg` : '—'} />
              <ProfileRow label={t('profile.heightCm')} value={user.height_cm ? `\u200E${user.height_cm} cm` : '—'} />
              <ProfileRow label={t('profile.diabetesType')} value={formatDiabetesType(user.diabetes_type)} isLast />
            </RNView>
          ) : null}

          <RNView style={{ marginTop: 8 }}>
            <GlowButton
              label={t('common.edit')}
              variant="primary"
              glow
              size="xl"
              onPress={() => router.push('/(onboarding)/profile?mode=edit')}
            />
          </RNView>
        </RNView>
      </RNView>
    </SafeAreaView>
  );
}

function ProfileRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  const theme = useTheme();
  return (
    <RNView
      style={[
        styles.row,
        {
          borderBottomWidth: isLast ? 0 : 1,
          borderColor: theme.borderColor.val,
        },
      ]}
    >
      <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: theme.colorMuted.val }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: 'Nunito_700Bold',
          fontSize: 15,
          color: theme.color.val,
          flex: 1,
          textAlign: 'right',
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </RNView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0 3px 10px rgba(61, 61, 61, 0.05)' } as any : {
      shadowColor: '#3D3D3D',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    }),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
});
