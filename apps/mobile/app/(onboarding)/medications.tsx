import { useRouter } from 'expo-router';
import { Plus, Trash2, Pill } from '@tamagui/lucide-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'tamagui';
import { MotiView } from 'moti';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { OnboardingProgressBar } from '../../src/components/OnboardingProgressBar';
import { api } from '../../src/lib/apiClient';

type Med = { name: string; dose: string; schedule: string; notes: string };

export default function Medications() {
  const { t } = useTranslation();
  const router = useRouter();
  const [meds, setMeds] = useState<Med[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function add() {
    setMeds((m) => [...m, { name: '', dose: '', schedule: '', notes: '' }]);
  }
  function update(i: number, key: keyof Med, value: string) {
    setMeds((m) => m.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)));
  }
  function remove(i: number) {
    setMeds((m) => m.filter((_, idx) => idx !== i));
  }

  async function onContinue() {
    setError(null);
    setBusy(true);
    try {
      const validMeds = meds.filter((m) => m.name.trim());
      if (validMeds.length > 0) {
        await api.put('/api/v1/auth/profile', {
          medications: validMeds.map((m) => ({
            name: m.name,
            dose: m.dose || null,
            schedule: m.schedule || null,
            notes: m.notes || null,
          })),
        });
      }
      router.push('/(onboarding)/language');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step 3 of 4 Progress Bar */}
        <OnboardingProgressBar step={3} />

        {/* Amber Safety Disclaimer Banner */}
        <View style={styles.disclaimerBanner}>
          <Text style={{ fontSize: 14 }}>🛡️</Text>
          <Text style={styles.disclaimerText}>
            <Text style={{ fontWeight: '700' }}>Educational only</Text> — We never prescribe or adjust doses.
          </Text>
        </View>

        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18 }}
          style={styles.headerBlock}
        >
          <Text style={styles.title}>
            {t('medications.title', { defaultValue: 'Current Medications' })}{' '}
            <Text style={{ fontSize: 22 }}>💊</Text>
          </Text>
          <Text style={styles.subtitle}>
            {t('medications.subtitle', {
              defaultValue: 'Optional context for your profile to help understand glycemic patterns.',
            })}
          </Text>
        </MotiView>

        {/* Empty state */}
        {meds.length === 0 && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 300 }}
            style={styles.emptyCard}
          >
            <View style={styles.emptyIconCircle}>
              <Pill size={24} color="#8E8E8E" />
            </View>
            <Text style={styles.emptyTitle}>No medications added yet</Text>
            <Text style={styles.emptySub}>
              Tap the button below to add your insulin, metformin, or other prescriptions.
            </Text>
          </MotiView>
        )}

        {/* Dynamic Medication Cards */}
        {meds.map((m, i) => (
          <MotiView
            key={i}
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={styles.medCard}
          >
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <View style={styles.medBadge}>
                <View style={styles.medDot} />
                <Text style={styles.medBadgeText}>Medication #{i + 1}</Text>
              </View>

              <PressableScale onPress={() => remove(i)} scale={0.9}>
                <View style={styles.deleteBtn}>
                  <Trash2 size={16} color="#E57373" />
                </View>
              </PressableScale>
            </View>

            {/* Field: Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Medication Name</Text>
              <View style={styles.fieldInputCard}>
                <TextInput
                  value={m.name}
                  onChangeText={(v) => update(i, 'name', v)}
                  placeholder="e.g. Metformin, Lantus"
                  placeholderTextColor="#8E8E8E"
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* Row: Dose + Frequency */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Dose</Text>
                <View style={styles.fieldInputCard}>
                  <TextInput
                    value={m.dose}
                    onChangeText={(v) => update(i, 'dose', v)}
                    placeholder="e.g. 500 mg"
                    placeholderTextColor="#8E8E8E"
                    style={styles.textInput}
                  />
                </View>
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Frequency</Text>
                <View style={styles.fieldInputCard}>
                  <TextInput
                    value={m.schedule}
                    onChangeText={(v) => update(i, 'schedule', v)}
                    placeholder="e.g. Twice daily"
                    placeholderTextColor="#8E8E8E"
                    style={styles.textInput}
                  />
                </View>
              </View>
            </View>

            {/* Field: Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Timing & Routine Notes</Text>
              <View style={styles.fieldInputCard}>
                <TextInput
                  value={m.notes}
                  onChangeText={(v) => update(i, 'notes', v)}
                  placeholder="e.g. Taken after breakfast and dinner"
                  placeholderTextColor="#8E8E8E"
                  style={styles.textInput}
                />
              </View>
            </View>
          </MotiView>
        ))}

        {/* Add Another Medication Button */}
        <PressableScale onPress={add} scale={0.98} style={{ width: '100%', marginTop: 8 }}>
          <View style={styles.addBtn}>
            <View style={styles.plusIconCircle}>
              <Plus size={16} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Text style={styles.addBtnText}>Add Medication</Text>
          </View>
        </PressableScale>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Bottom Actions */}
        <View style={{ paddingTop: 32, paddingBottom: 24, alignItems: 'center' }}>
          <GlowButton
            label={t('common.continue', { defaultValue: 'Continue' })}
            glow
            size="xl"
            disabled={busy}
            onPress={onContinue}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3CD',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  disclaimerText: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 12,
    color: '#3D3D3D',
    flex: 1,
  },
  headerBlock: {
    marginBottom: 18,
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
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
    shadowColor: 'rgba(61,61,61,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: '#3D3D3D',
    marginBottom: 4,
  },
  emptySub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#8E8E8E',
    textAlign: 'center',
    lineHeight: 17,
  },
  medCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
    shadowColor: 'rgba(61,61,61,0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8DEF8',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  medDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#006A61',
  },
  medBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#3D3D3D',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFDAD6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    gap: 4,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#8E8E8E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  fieldInputCard: {
    height: 48,
    backgroundColor: '#FFF5EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
  },
  textInput: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: '#3D3D3D',
    height: '100%',
    padding: 0,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 9999,
    backgroundColor: '#FFF5EB',
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.08)',
    shadowColor: 'rgba(61,61,61,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  plusIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFB347',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#3D3D3D',
  },
  errorBox: {
    backgroundColor: '#FFDAD6',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#BA1A1A',
  },
});
