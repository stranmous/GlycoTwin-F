import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Text, View } from 'tamagui';

import { AnimatedCard } from '../../src/components/motion/AnimatedCard';
import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { ShimmerSkeleton } from '../../src/components/motion/ShimmerSkeleton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Trash2 } from '@tamagui/lucide-icons';
import { api } from '../../src/lib/apiClient';
import type { DetectedFoodOut, MealOut } from '../../src/types/api';

type EditableFood = DetectedFoodOut & { dirty?: boolean };

export default function Result() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const { mealId } = useLocalSearchParams<{ mealId: string }>();

  const { data: meal, isLoading } = useQuery<MealOut>({
    queryKey: ['meal', mealId],
    queryFn: () => api.get(`/v1/meals/${mealId}`),
    enabled: !!mealId,
  });

  const [foods, setFoods] = useState<EditableFood[] | null>(null);
  const editableFoods: EditableFood[] = foods ?? (meal?.detected_foods ?? []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updated = await api.put(`/v1/meals/${mealId}`, {
        detected_foods: editableFoods.map((f) => ({
          name_en: f.name_en,
          name_ur: f.name_ur,
          portion_g: f.portion_g,
          carbs_g: f.carbs_g,
          kcal: f.kcal,
          confidence: f.confidence,
        })),
        user_edited: true,
      });
      // Generate prediction baseline for this meal so it populates Insights
      await api.post('/v1/predictions/baseline', { meal_id: mealId });
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meals'], exact: false });
      qc.invalidateQueries({ queryKey: ['insights'], exact: false });
      router.replace('/(tabs)');
    },
  });

  function updateFood(id: string, key: keyof DetectedFoodOut, value: string) {
    setFoods((prev) =>
      (prev ?? meal!.detected_foods).map((f) =>
        f.id === id
          ? { ...f, [key]: key === 'name_en' ? value : Number(value), dirty: true }
          : f,
      ),
    );
  }

  function deleteFood(id: string) {
    setFoods((prev) => (prev ?? meal!.detected_foods).filter((f) => f.id !== id));
  }

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View f={1} bg="$background" px="$4" pt="$6" gap="$4">
          <ShimmerSkeleton height={28} width="60%" />
          <ShimmerSkeleton height={120} />
          <ShimmerSkeleton height={120} />
        </View>
      </SafeAreaView>
    );
  }

  const totalCarbs = editableFoods.reduce((s, f) => s + f.carbs_g, 0);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background">
        <ScreenHeader title={t('result.title')} />

        <View px="$4" pb="$3">
          <View
            bg="rgba(45,212,191,0.10)"
            br="$8"
            px="$5"
            py="$3"
            fd="row"
            jc="space-between"
            ai="center"
            borderWidth={1.5}
            borderColor="rgba(45,212,191,0.25)"
            style={{
              shadowColor: 'rgba(45,212,191,0.15)',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 1,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <Text color="$colorMuted" fontSize="$4"
              style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
              {t('result.totalCarbs')}
            </Text>
            <Text color="$primary" fontSize="$7" fontWeight="800"
              style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}>
              {totalCarbs.toFixed(1)}g
            </Text>
          </View>
        </View>

        <FlatList
          data={editableFoods}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item, index }) => (
            <AnimatedCard delay={index * 60}>
              <View gap="$3">
                {/* Confidence badge — pill */}
                <View fd="row" ai="center" jc="space-between">
                  <View
                    px="$3"
                    py="$1"
                    br="$8"
                    bg={item.confidence >= 0.8
                      ? 'rgba(45,212,191,0.12)'
                      : 'rgba(255,178,76,0.12)'}
                    borderWidth={1}
                    borderColor={item.confidence >= 0.8
                      ? 'rgba(45,212,191,0.3)'
                      : 'rgba(255,178,76,0.3)'}
                  >
                    <Text
                      fontSize="$3"
                      fontWeight="700"
                      color={item.confidence >= 0.8 ? '$primary' : '#FFB24C'}
                      style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
                    >
                      {(item.confidence * 100).toFixed(0)}% {t('result.confidence')}
                    </Text>
                  </View>
                  <PressableScale onPress={() => deleteFood(item.id)} scale={0.9}>
                    <View p="$2" br="$8" bg="rgba(244,63,94,0.1)" borderWidth={1} borderColor="rgba(244,63,94,0.2)">
                      <Trash2 size={16} color="#F43F5E" />
                    </View>
                  </PressableScale>
                </View>
                <Input
                  value={item.name_en}
                  onChangeText={(v) => updateFood(item.id, 'name_en', v)}
                  fontSize="$5"
                  fontWeight="600"
                  size="$5"
                  br="$6"
                  borderWidth={1.5}
                  borderColor="$borderColor"
                  focusStyle={{ borderColor: '$primary' }}
                  style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}
                />
                <View fd="row" gap="$3">
                  <View f={1} gap="$1">
                    <Text fontSize="$3" color="$colorMuted">{t('result.portion')} (g)</Text>
                    <Input
                      value={String(item.portion_g)}
                      onChangeText={(v) => updateFood(item.id, 'portion_g', v)}
                      keyboardType="decimal-pad"
                      size="$5"
                      br="$6"
                      borderWidth={1.5}
                      borderColor="$borderColor"
                      focusStyle={{ borderColor: '$primary' }}
                    />
                  </View>
                  <View f={1} gap="$1">
                    <Text fontSize="$3" color="$colorMuted">Carbs (g)</Text>
                    <Input
                      value={String(item.carbs_g)}
                      onChangeText={(v) => updateFood(item.id, 'carbs_g', v)}
                      keyboardType="decimal-pad"
                      size="$5"
                      br="$6"
                      borderWidth={1.5}
                      borderColor="$borderColor"
                      focusStyle={{ borderColor: '$primary' }}
                    />
                  </View>
                </View>
              </View>
            </AnimatedCard>
          )}
        />

        <View px="$4" pb="$4" gap="$4">
          <GlowButton
            label={t('result.save')}
            glow
            size="xl"
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          />
          <GlowButton
            label={t('result.discard')}
            variant="ghost"
            size="xl"
            onPress={() => router.back()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
