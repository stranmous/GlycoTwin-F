import { useRouter } from 'expo-router';
import { Plus, Trash2, Pill } from '@tamagui/lucide-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Text, View } from 'tamagui';
import { MotiView } from 'moti';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { SafetyBadge } from '../../src/components/SafetyBadge';
import { api } from '../../src/lib/apiClient';

type Med = { name: string; dose: string; schedule: string; notes: string };

const PLACEHOLDER_COLOR = 'rgba(186,202,197,0.35)';
const INPUT_PROPS = {
  br: '$6' as any,
  borderWidth: 1.5,
  borderColor: '$borderColor' as any,
  bg: '$surfaceMuted' as any,
  focusStyle: { borderColor: '$primary' } as any,
  size: '$5' as any,
  color: '#FFF8EA' as any,
  placeholderTextColor: PLACEHOLDER_COLOR,
};

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
        await api.put('/v1/me/profile', {
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
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="#0E1726">
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18 }}
          style={styles.header}
        >
          <Text style={styles.title} color="#FFF8EA">{t('medications.title')}</Text>
          <Text style={styles.subtitle} color="rgba(186,202,197,0.6)">{t('medications.subtitle')}</Text>
          <View mt="$3">
            <SafetyBadge label={t('safety.educationalOnly')} />
          </View>
        </MotiView>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Empty state */}
          {meds.length === 0 && (
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 400 }}
            >
              <View ai="center" gap="$3" py="$6">
                <View
                  width={56}
                  height={56}
                  borderRadius={28}
                  bg="rgba(45,212,191,0.08)"
                  borderWidth={1.5}
                  borderColor="rgba(45,212,191,0.2)"
                  ai="center"
                  jc="center"
                >
                  <Pill size={24} color="rgba(45,212,191,0.6)" />
                </View>
                <Text
                  color="rgba(186,202,197,0.5)"
                  textAlign="center"
                  fontSize="$4"
                  style={{ fontFamily: 'SpaceGrotesk_400Regular' }}
                >
                  {t('medications.empty')}
                </Text>
              </View>
            </MotiView>
          )}

          {/* Medication cards */}
          {meds.map((m, i) => (
            <MotiView
              key={i}
              from={{ opacity: 0, translateY: 12 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', damping: 18, delay: i * 60 }}
            >
              <View
                bg="rgba(255,255,255,0.04)"
                br="$6"
                p="$5"
                gap="$4"
                borderWidth={1.5}
                borderColor="rgba(186,202,197,0.12)"
                mb="$4"
                style={{
                  shadowColor: 'rgba(45,212,191,0.06)',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 1,
                  shadowRadius: 16,
                  elevation: 3,
                } as any}
              >
                {/* Card header */}
                <View fd="row" jc="space-between" ai="center">
                  <Text
                    fontWeight="700"
                    fontSize="$5"
                    color="rgba(45,212,191,0.9)"
                    style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
                  >
                    Medication #{i + 1}
                  </Text>
                  <PressableScale onPress={() => remove(i)} scale={0.88}>
                    <View
                      width={36}
                      height={36}
                      borderRadius={18}
                      bg="rgba(244,63,94,0.1)"
                      borderWidth={1}
                      borderColor="rgba(244,63,94,0.25)"
                      ai="center"
                      jc="center"
                    >
                      <Trash2 size={16} color="#F43F5E" />
                    </View>
                  </PressableScale>
                </View>

                <Input
                  {...INPUT_PROPS}
                  placeholder={t('medications.name')}
                  value={m.name}
                  onChangeText={(v) => update(i, 'name', v)}
                />
                <Input
                  {...INPUT_PROPS}
                  placeholder={t('medications.dose')}
                  value={m.dose}
                  onChangeText={(v) => update(i, 'dose', v)}
                />
                <Input
                  {...INPUT_PROPS}
                  placeholder={t('medications.schedule')}
                  value={m.schedule}
                  onChangeText={(v) => update(i, 'schedule', v)}
                />
                <Input
                  {...INPUT_PROPS}
                  placeholder={t('medications.notes')}
                  value={m.notes}
                  onChangeText={(v) => update(i, 'notes', v)}
                />
              </View>
            </MotiView>
          ))}

          {/* Add medication button */}
          <GlowButton
            label={t('medications.add')}
            variant="secondary"
            size="xl"
            icon={<Plus size={20} />}
            onPress={add}
          />

          {/* Error */}
          {error ? (
            <Text color="#F43F5E" fontSize="$3" textAlign="center" mt="$2">
              {error}
            </Text>
          ) : null}

          {/* Continue */}
          <View mt="$4" mb="$2">
            <GlowButton
              label={t('common.continue')}
              onPress={onContinue}
              disabled={busy}
              glow
              size="xl"
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(186,202,197,0.08)',
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 34,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 15,
    marginTop: 4,
  },
  scroll: {
    padding: 24,
    paddingTop: 20,
    gap: 0,
  },
});
