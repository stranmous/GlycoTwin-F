import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Text, View } from 'tamagui';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { env } from '../../src/lib/env';
import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { api } from '../../src/lib/apiClient';
import type { UserOut } from '../../src/types/api';

type Sex = 'male' | 'female' | 'other';
type DType = 'type1' | 'type2' | 'gestational' | 'prediabetes' | 'none';

const SEX_OPTIONS: Sex[] = ['male', 'female', 'other'];
const DTYPE_OPTIONS: DType[] = ['type1', 'type2', 'gestational', 'prediabetes', 'none'];

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Detect edit mode: when coming from /settings/profile the URL will carry ?mode=edit
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = params.mode === 'edit';

  // Fetch existing profile to pre-populate
  const { data: user, isLoading } = useQuery<UserOut>({
    queryKey: ['me'],
    queryFn: () => api.get('/v1/me'),
  });

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [diabetes, setDiabetes] = useState<DType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate fields once user data is loaded
  useEffect(() => {
    if (!user) return;
    if (user.display_name) setName(user.display_name);
    if (user.age) setAge(String(user.age));
    if (user.sex) setSex(user.sex as Sex);
    if (user.height_cm) setHeight(String(user.height_cm));
    if (user.weight_kg) setWeight(String(user.weight_kg));
    if (user.diabetes_type) setDiabetes(user.diabetes_type as DType);
  }, [user]);

  function validate(): string | null {
    if (!name.trim()) return 'Please enter your name.';
    if (age) {
      const n = Number(age);
      if (isNaN(n) || !Number.isInteger(n)) return 'Age must be a whole number.';
      if (n < 12 || n > 81) return 'Age must be between 12 and 81.';
    }
    if (height) {
      const n = Number(height);
      if (isNaN(n)) return 'Height must be a number.';
      if (n < 60 || n > 250) return 'Height must be between 60 and 250 cm.';
    }
    if (weight) {
      const n = Number(weight);
      if (isNaN(n)) return 'Weight must be a number.';
      if (n < 10 || n > 500) return 'Weight must be between 10 and 500 kg.';
    }
    return null;
  }

  async function onSubmit() {
    setError(null);
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setBusy(true);
    try {
      await api.put('/v1/me/profile', {
        display_name: name.trim(),
        age: age ? Number(age) : null,
        sex,
        height_cm: height ? Number(height) : null,
        weight_kg: weight ? Number(weight) : null,
        diabetes_type: diabetes,
        consent_accepted: true,
      });

      // Invalidate cached user so settings/profile shows fresh data
      await queryClient.invalidateQueries({ queryKey: ['me'] });

      if (isEditMode) {
        router.back(); // Go back to /settings/profile
      } else {
        router.push('/(onboarding)/medications');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (env.authDevBypass) {
        console.warn('[dev] profile API failed, skipping:', msg);
        if (!isEditMode) router.push('/(onboarding)/medications');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel = isEditMode ? 'Save' : t('common.continue');
  const headerTitle = isEditMode ? 'Edit Profile' : t('profile.title');
  const headerSubtitle = isEditMode ? undefined : t('profile.subtitle');

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background">
        <ScreenHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          showBack={isEditMode}
        />
        {isLoading ? (
          <View f={1} ai="center" jc="center">
            <Text color="$colorMuted">Loading your profile…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <Field label="Name">
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor="rgba(186,202,197,0.35)"
                autoCapitalize="words"
                size="$5" br="$6" borderWidth={1.5} borderColor="$borderColor"
                bg="$surfaceMuted" focusStyle={{ borderColor: '$primary' }} />
            </Field>

            <Field label={t('profile.age')}>
              <Input
                value={age}
                onChangeText={(v) => setAge(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="12 – 81"
                placeholderTextColor="rgba(186,202,197,0.35)"
                size="$5" br="$6" borderWidth={1.5} borderColor="$borderColor"
                bg="$surfaceMuted" focusStyle={{ borderColor: '$primary' }} />
            </Field>

            <Field label={t('profile.sex')}>
              <View fd="row" gap="$2" flexWrap="wrap">
                {SEX_OPTIONS.map((s) => (
                  <Chip key={s} active={sex === s} label={t(`profile.sex${cap(s)}`)} onPress={() => setSex(s)} />
                ))}
              </View>
            </Field>

            <Field label={t('profile.heightCm')}>
              <Input
                value={height}
                onChangeText={(v) => setHeight(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="60 – 250"
                placeholderTextColor="rgba(186,202,197,0.35)"
                size="$5" br="$6" borderWidth={1.5} borderColor="$borderColor"
                bg="$surfaceMuted" focusStyle={{ borderColor: '$primary' }} />
            </Field>

            <Field label={t('profile.weightKg')}>
              <Input
                value={weight}
                onChangeText={(v) => setWeight(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="10 – 500"
                placeholderTextColor="rgba(186,202,197,0.35)"
                size="$5" br="$6" borderWidth={1.5} borderColor="$borderColor"
                bg="$surfaceMuted" focusStyle={{ borderColor: '$primary' }} />
            </Field>

            <Field label={t('profile.diabetesType')}>
              <View fd="row" gap="$2" flexWrap="wrap">
                {DTYPE_OPTIONS.map((d) => (
                  <Chip key={d} active={diabetes === d} label={t(`profile.${d}`)} onPress={() => setDiabetes(d)} />
                ))}
              </View>
            </Field>

            {error ? (
              <Text color="$danger" fontSize="$3" textAlign="center">{error}</Text>
            ) : null}
            <View mt="$4">
              <GlowButton label={buttonLabel} onPress={onSubmit} disabled={busy} glow size="xl" />
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function cap(s: string) { return s[0].toUpperCase() + s.slice(1); }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View gap="$2">
      <Text
        fontSize="$3"
        color="$colorMuted"
        fontWeight="600"
        style={{ fontFamily: 'PlusJakartaSans_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 } as any}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scale={0.93}>
      <View
        px="$4"
        py="$2"
        br="$8"
        bg={active ? '$primary' : '$surfaceMuted'}
        borderWidth={1.5}
        borderColor={active ? '$primary' : '$borderColor'}
        style={active ? {
          shadowColor: 'rgba(45,212,191,0.35)',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 1,
          shadowRadius: 8,
          elevation: 3,
        } as any : undefined}
      >
        <Text
          color={active ? '$onPrimary' : '$colorMuted'}
          fontWeight="700"
          style={{ fontFamily: 'PlusJakartaSans_700Bold' } as any}
        >
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}
