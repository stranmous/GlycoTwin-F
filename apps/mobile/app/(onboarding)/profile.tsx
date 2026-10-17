import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Theme } from 'tamagui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MotiView } from 'moti';
import { ShieldAlert } from '@tamagui/lucide-icons';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { OnboardingProgressBar } from '../../src/components/OnboardingProgressBar';
import { api } from '../../src/lib/apiClient';
import { useAuthStore } from '../../src/lib/authStore';
import { useTwinStore } from '../../src/lib/twinStore';
import type { UserOut } from '../../src/types/api';

type Sex = 'male' | 'female' | 'other';
type DType = 'type1' | 'type2' | 'gestational' | 'prediabetes' | 'none';

const SEX_OPTIONS: { key: Sex; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
];

const DTYPE_OPTIONS: { key: DType; label: string; desc: string }[] = [
  { key: 'type2', label: 'Type 2 Diabetes', desc: 'Adult-onset metabolic pattern' },
  { key: 'type1', label: 'Type 1 Diabetes', desc: 'Autoimmune insulin-dependent' },
  { key: 'prediabetes', label: 'Prediabetes', desc: 'Borderline glycemic elevation' },
  { key: 'gestational', label: 'Gestational', desc: 'Pregnancy-associated diabetes' },
  { key: 'none', label: 'General Wellness', desc: 'Metabolic fitness & glucose balance' },
];

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { uid } = useAuthStore();

  const params = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = params.mode === 'edit';

  const { data: user } = useQuery<UserOut>({
    queryKey: ['me', uid],
    queryFn: () => api.get('/api/v1/auth/profile'),
  });

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [diabetes, setDiabetes] = useState<DType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    try {
      const profileData = {
        display_name: name.trim(),
        age: age ? Number(age) : null,
        sex,
        height_cm: height ? Number(height) : null,
        weight_kg: weight ? Number(weight) : null,
        diabetes_type: diabetes,
        activity_level: 'moderate',
        consent_accepted: true,
      };

      const updated = await api.put<UserOut>('/api/v1/auth/profile', profileData);

      // Trigger physiological twin calibration upon onboarding profile completion (R2)
      await useTwinStore.getState().calibrateTwin({
        age: profileData.age ?? 42,
        weight_kg: profileData.weight_kg,
        height_cm: profileData.height_cm,
        diabetes_type: profileData.diabetes_type ?? 'type_2',
        sex: profileData.sex ?? undefined,
      }).catch(() => {});

      if (updated) {
        queryClient.setQueryData(['me'], updated);
        if (uid) queryClient.setQueryData(['me', uid], updated);
      }
      await queryClient.invalidateQueries({ queryKey: ['me'] });

      if (isEditMode) {
        router.back();
      } else {
        router.push('/(onboarding)/medications');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Theme name="light">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
        {isEditMode ? (
          <ScreenHeader title={t('profile.title', { defaultValue: 'Edit Profile' })} showBack />
        ) : null}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!isEditMode && <OnboardingProgressBar step={2} />}

          {/* Friendly Conversational Greeting */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={styles.headerBlock}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {t('profile.title', { defaultValue: 'Tell us about you' })}{' '}
                <Text style={{ fontSize: 22 }}>😊</Text>
              </Text>
              <Text style={styles.subtitle}>
                {t('profile.subtitle', {
                  defaultValue:
                    'Used to personalize your glucose response curves and metabolic forecast.',
                })}
              </Text>
            </View>
            <View style={styles.avatarBadge}>
              <Text style={{ fontSize: 24 }}>✨</Text>
            </View>
          </MotiView>

          {/* Insight Pill */}
          <View style={styles.insightPill}>
            <Text style={{ fontSize: 14 }}>💡</Text>
            <Text style={styles.insightText}>
              Personalizing curves helps calibrate healthy post-meal targets!
            </Text>
          </View>

          {/* Full Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputCard}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your preferred name"
                placeholderTextColor="#8E8E8E"
                style={styles.textInput}
              />
            </View>
          </View>

          {/* 3-Column Grid: Age, Weight, Height */}
          <View style={styles.inputGroup}>
            <View style={styles.rowHeader}>
              <Text style={styles.label}>Physical Attributes</Text>
              <Text style={styles.unitSub}>Metric (kg / cm)</Text>
            </View>
            <View style={styles.tripleGrid}>
              {/* Age Card */}
              <View style={styles.gridCard}>
                <Text style={styles.gridCardLabel}>🎂 Age</Text>
                <TextInput
                  value={age}
                  onChangeText={setAge}
                  placeholder="28"
                  placeholderTextColor="#8E8E8E"
                  keyboardType="numeric"
                  style={styles.gridInput}
                />
                <Text style={styles.gridUnit}>years</Text>
              </View>

              {/* Weight Card */}
              <View style={styles.gridCard}>
                <Text style={styles.gridCardLabel}>⚖️ Weight</Text>
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="70"
                  placeholderTextColor="#8E8E8E"
                  keyboardType="numeric"
                  style={styles.gridInput}
                />
                <Text style={styles.gridUnit}>kg</Text>
              </View>

              {/* Height Card */}
              <View style={styles.gridCard}>
                <Text style={styles.gridCardLabel}>📏 Height</Text>
                <TextInput
                  value={height}
                  onChangeText={setHeight}
                  placeholder="172"
                  placeholderTextColor="#8E8E8E"
                  keyboardType="numeric"
                  style={styles.gridInput}
                />
                <Text style={styles.gridUnit}>cm</Text>
              </View>
            </View>
          </View>

          {/* Biological Sex Chips */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Biological Sex</Text>
            <View style={styles.chipRow}>
              {SEX_OPTIONS.map((opt) => {
                const active = sex === opt.key;
                return (
                  <PressableScale
                    key={opt.key}
                    onPress={() => setSex(opt.key)}
                    scale={0.96}
                    style={{ flex: 1 }}
                  >
                    <View
                      style={[
                        styles.chip,
                        active ? styles.chipActive : styles.chipInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active ? styles.chipTextActive : styles.chipTextInactive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {/* Diabetes Type Cards */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Diabetes Context</Text>
            <View style={styles.typeList}>
              {DTYPE_OPTIONS.map((opt) => {
                const active = diabetes === opt.key;
                return (
                  <PressableScale
                    key={opt.key}
                    onPress={() => setDiabetes(opt.key)}
                    scale={0.98}
                    style={{ width: '100%' }}
                  >
                    <View
                      style={[
                        styles.typeCard,
                        active && styles.typeCardActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.radioDot,
                          active && styles.radioDotActive,
                        ]}
                      >
                        {active ? <View style={styles.radioInner} /> : null}
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-start' }}>
                        <Text style={styles.typeLabel}>{opt.label}</Text>
                        <Text style={styles.typeDesc}>{opt.desc}</Text>
                      </View>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </View>

        {/* Error notice */}
        {error ? (
          <View style={styles.errorBox}>
            <ShieldAlert size={16} color="#BA1A1A" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

          {/* Continue Button */}
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <GlowButton
              label={isEditMode ? t('common.save', { defaultValue: 'Save Profile' }) : t('common.continue', { defaultValue: 'Continue' })}
              glow
              size="xl"
              disabled={busy}
              onPress={onSubmit}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Theme>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  headerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 24,
    color: '#3D3D3D',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 13,
    color: '#8E8E8E',
    lineHeight: 18,
  },
  avatarBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE5D9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
  },
  insightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF3CD',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  insightText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#3D3D3D',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 18,
    gap: 6,
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#8E8E8E',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  unitSub: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 11,
    color: '#8E8E8E',
  },
  inputCard: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(61,61,61,0.1)',
    paddingHorizontal: 16,
    justifyContent: 'center',
    shadowColor: 'rgba(61,61,61,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  textInput: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    color: '#3D3D3D',
    height: '100%',
    padding: 0,
  },
  tripleGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: 'rgba(61,61,61,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  gridCardLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#8E8E8E',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  gridInput: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    color: '#3D3D3D',
    textAlign: 'center',
    padding: 0,
    minHeight: 28,
  },
  gridUnit: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 11,
    color: '#8E8E8E',
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    height: 44,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: '#2AA89A',
    borderColor: '#2AA89A',
  },
  chipInactive: {
    backgroundColor: '#FFF5EB',
    borderColor: 'rgba(61,61,61,0.06)',
  },
  chipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipTextInactive: {
    color: '#3D3D3D',
  },
  typeList: {
    gap: 8,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(61,61,61,0.08)',
    shadowColor: 'rgba(61,61,61,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  typeCardActive: {
    borderColor: '#2AA89A',
    backgroundColor: '#D4F5E9',
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(61,61,61,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotActive: {
    borderColor: '#2AA89A',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2AA89A',
  },
  typeLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#3D3D3D',
    marginBottom: 2,
  },
  typeDesc: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#8E8E8E',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFDAD6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  errorText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#BA1A1A',
    flex: 1,
  },
});
