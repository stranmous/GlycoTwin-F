import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Platform, ScrollView, StyleSheet, View as RNView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Text, useTheme, useThemeName } from 'tamagui';
import { Trash2 } from '@tamagui/lucide-icons';

import { AnimatedCard } from '../../src/components/motion/AnimatedCard';
import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { ShimmerSkeleton } from '../../src/components/motion/ShimmerSkeleton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SafetyBadge } from '../../src/components/SafetyBadge';
import { api } from '../../src/lib/apiClient';
import type { DetectedFoodOut, MealOut, NutritionEstimateOut } from '../../src/types/api';

type EditableFood = DetectedFoodOut & { dirty?: boolean };

type ManualMeal = {
  name: string;
  carbs: string;
  protein: string;
  fat: string;
  fiber: string;
};

function total(items: EditableFood[], key: 'portion_g' | 'carbs_g' | 'kcal') {
  return items.reduce((sum, item) => sum + item[key], 0);
}

function totalFromItems(items: NutritionEstimateOut['items'], key: 'mass_g' | 'carbs_g' | 'calories_kcal') {
  return items.reduce((sum, item) => sum + item[key], 0);
}

export default function Result() {
  const { t } = useTranslation();
  const theme = useTheme();
  const themeName = useThemeName();
  const isDark = themeName.startsWith('dark');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mealId, dishHint, estimateJson, imageUri, mode } = useLocalSearchParams<{
    mealId?: string;
    dishHint?: string;
    estimateJson?: string;
    imageUri?: string;
    mode?: string;
  }>();

  const estimate: NutritionEstimateOut | null = useMemo(() => {
    if (!estimateJson) return null;
    try {
      return JSON.parse(estimateJson) as NutritionEstimateOut;
    } catch {
      return null;
    }
  }, [estimateJson]);

  const { data: meal, isLoading } = useQuery<MealOut>({
    queryKey: ['meal', mealId],
    queryFn: () => api.get<MealOut>(`/api/v1/ingestion/history/meals/${mealId}`),
    enabled: Boolean(mealId) && !estimate && mode !== 'manual',
  });

  const initialFoods = useMemo<EditableFood[]>(() => {
    if (estimate?.status === 'estimated') {
      const firstItem = estimate.items[0];
      return [{
        id: `estimate-${estimate.id ?? 'meal'}`,
        name_en: estimate.dish?.label ?? firstItem?.requested_label ?? dishHint ?? 'Meal',
        name_ur: null,
        portion_g: estimate.total_mass_g ?? totalFromItems(estimate.items, 'mass_g'),
        carbs_g: estimate.carbs_g ?? totalFromItems(estimate.items, 'carbs_g'),
        kcal: estimate.calories_kcal ?? totalFromItems(estimate.items, 'calories_kcal'),
        confidence: estimate.confidence ?? 0.85,
      }];
    }
    return meal?.detected_foods ?? [];
  }, [dishHint, estimate, meal]);

  const [foods, setFoods] = useState<EditableFood[] | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(mode === 'manual');
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [manualMeal, setManualMeal] = useState<ManualMeal>({
    name: dishHint ?? '',
    carbs: '',
    protein: '',
    fat: '',
    fiber: '',
  });
  const editableFoods = foods ?? initialFoods;
  const totalCarbs = total(editableFoods, 'carbs_g');
  const totalMass = total(editableFoods, 'portion_g');
  const isImplausibleMass = totalMass > 1500;
  const hasEdits = foods !== null;
  const isRejected = estimate?.status === 'rejected';
  const manualValues = {
    carbs: Number(manualMeal.carbs),
    protein: Number(manualMeal.protein),
    fat: Number(manualMeal.fat),
    fiber: Number(manualMeal.fiber),
  };
  const isManualValid = Boolean(manualMeal.name.trim())
    && [manualMeal.carbs, manualMeal.protein, manualMeal.fat, manualMeal.fiber]
      .every((value) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0);
  const manualCalories = manualValues.carbs * 4 + manualValues.protein * 4 + manualValues.fat * 9;

  const discardMutation = useMutation({
    mutationFn: async () => {
      if (estimate?.id) {
        await api.del(`/api/v1/ingestion/history/meals/${estimate.id}`).catch(() => {});
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      router.replace('/(tabs)');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!estimate || estimate.status !== 'estimated') {
        throw new Error('There is no nutrition estimate to save.');
      }

      // M5 persists an estimated meal before responding. Avoid a duplicate write
      // unless the user changed the confirmed label, portion, or carbohydrates.
      if (estimate.id && !hasEdits) return;

      const primaryFood = editableFoods[0];
      const payload = {
        timestamp: new Date().toISOString(),
        name: primaryFood?.name_en ?? estimate.dish?.label ?? 'Meal',
        dish_label: primaryFood?.name_en ?? estimate.dish?.label ?? 'Meal',
        carbohydrates_g: totalCarbs,
        protein_g: estimate.protein_g ?? 0,
        fat_g: estimate.fat_g ?? 0,
        fiber_g: estimate.fiber_g ?? 0,
        meal_type: 'dinner',
        detected_foods: editableFoods,
        image_url: estimate.image_url ?? imageUri ?? null,
      };

      if (estimate.id) {
        await api.put(`/api/v1/ingestion/history/meals/${estimate.id}`, payload);
      } else {
        await api.post('/api/v1/ingestion/meal', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      router.replace('/(tabs)');
    },
  });

  const manualSaveMutation = useMutation({
    mutationFn: async () => {
      if (estimate?.id) {
        await api.del(`/api/v1/ingestion/history/meals/${estimate.id}`).catch(() => {});
      }
      return api.post('/api/v1/ingestion/meal', {
        timestamp: new Date().toISOString(),
        name: manualMeal.name.trim(),
        dish_label: manualMeal.name.trim(),
        carbohydrates_g: manualValues.carbs,
        protein_g: manualValues.protein,
        fat_g: manualValues.fat,
        fiber_g: manualValues.fiber,
        meal_type: 'dinner',
        image_url: estimate?.image_url ?? imageUri ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      router.replace('/(tabs)');
    },
  });

  const suggestionMutation = useMutation({
    mutationFn: async (selectedDish: string) => {
      if (!imageUri || imageUri.startsWith('/')) {
        throw new Error('The original image is no longer available. Please select it again from the scanner.');
      }

      const form = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        form.append('image', blob, 'meal.jpg');
      } else {
        form.append('image', { uri: imageUri, type: 'image/jpeg', name: 'meal.jpg' } as unknown as Blob);
      }
      form.append('dish_hint', selectedDish);
      return api.upload<NutritionEstimateOut>('/api/v1/nutrition/estimate', form);
    },
    onSuccess: (confirmedEstimate, selectedDish) => {
      router.replace({
        pathname: '/scan/result',
        params: {
          mealId: confirmedEstimate.id || `meal-${Date.now()}`,
          dishHint: selectedDish,
          estimateJson: JSON.stringify(confirmedEstimate),
          imageUri,
        },
      });
    },
    onError: (error) => {
      setSuggestionError(error instanceof Error ? error.message : 'Could not confirm this dish.');
    },
  });

  function updateFood(id: string, key: keyof DetectedFoodOut, value: string) {
    setFoods((previous) =>
      (previous ?? editableFoods).map((food) =>
        food.id === id
          ? { ...food, [key]: key === 'name_en' ? value : Number(value) || 0, dirty: true }
          : food,
      ),
    );
  }

  function deleteFood(id: string) {
    setFoods((previous) => (previous ?? editableFoods).filter((food) => food.id !== id));
  }

  function updateManualMeal(key: keyof ManualMeal, value: string) {
    setManualMeal((current) => ({ ...current, [key]: value }));
  }

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
        <RNView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 24, gap: 16 }}>
          <ShimmerSkeleton height={28} width="60%" />
          <ShimmerSkeleton height={120} />
          <ShimmerSkeleton height={120} />
        </RNView>
      </SafeAreaView>
    );
  }

  if (isManualEntry) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
        <RNView style={{ flex: 1 }}>
          <ScreenHeader
            title={t('result.title')}
            showBack
            onBack={() => {
              if (estimate) setIsManualEntry(false);
              else router.back();
            }}
          />
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 22, color: theme.color.val }}>
              Log nutrition manually
            </Text>
            <Text style={{ fontFamily: 'Nunito_500Medium', fontSize: 14, lineHeight: 20, color: theme.colorMuted.val }}>
              Enter what you know. This meal will be saved directly into your twin's history without AI estimation.
            </Text>
            <AnimatedCard>
              <RNView style={{ gap: 14 }}>
                <RNView style={{ gap: 4 }}>
                  <Text style={styles.fieldLabel}>Meal name</Text>
                  <Input
                    value={manualMeal.name}
                    onChangeText={(value) => updateManualMeal('name', value)}
                    placeholder="e.g. Chicken biryani, Fried eggs, Roti"
                    height={48}
                    br={18}
                    borderWidth={1.5}
                    borderColor="$borderColor"
                    focusStyle={{ borderColor: '$primary' }}
                    style={styles.input}
                  />
                </RNView>
                <RNView style={{ flexDirection: 'row', gap: 12 }}>
                  <MacroInput label="Carbohydrates (g)" value={manualMeal.carbs} onChangeText={(value) => updateManualMeal('carbs', value)} />
                  <MacroInput label="Protein (g)" value={manualMeal.protein} onChangeText={(value) => updateManualMeal('protein', value)} />
                </RNView>
                <RNView style={{ flexDirection: 'row', gap: 12 }}>
                  <MacroInput label="Fat (g)" value={manualMeal.fat} onChangeText={(value) => updateManualMeal('fat', value)} />
                  <MacroInput label="Fiber (g)" value={manualMeal.fiber} onChangeText={(value) => updateManualMeal('fiber', value)} />
                </RNView>
                {isManualValid && (
                  <Text style={[styles.calories, { color: isDark ? '#80CBC4' : '#006A61' }]}>
                    🔥 Energy: {manualCalories.toFixed(0)} kcal
                  </Text>
                )}
              </RNView>
            </AnimatedCard>

            <RNView style={{ marginTop: 'auto', paddingTop: 16, gap: 10 }}>
              <GlowButton
                label="Save manual meal"
                glow
                size="xl"
                onPress={() => manualSaveMutation.mutate()}
                disabled={!isManualValid || manualSaveMutation.isPending}
              />
              <GlowButton
                label={estimate ? 'Back to AI estimate' : 'Cancel'}
                variant="secondary"
                size="xl"
                onPress={() => {
                  if (estimate) setIsManualEntry(false);
                  else router.back();
                }}
              />
            </RNView>
          </ScrollView>
        </RNView>
      </SafeAreaView>
    );
  }

  if (isRejected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
        <RNView style={{ flex: 1 }}>
          <ScreenHeader title={t('result.title')} />
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <AnimatedCard>
              <RNView style={{ gap: 10 }}>
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 20, color: theme.color.val }}>
                  Nutrition estimate unavailable
                </Text>
                <Text style={{ fontFamily: 'Nunito_500Medium', fontSize: 15, lineHeight: 22, color: theme.colorMuted.val }}>
                  {estimate?.message || 'Could not recognize this food item.'}
                </Text>
              </RNView>
            </AnimatedCard>

            {estimate?.dish_suggestions && estimate.dish_suggestions.length > 0 && (
              <RNView style={{ gap: 8 }}>
                <Text style={styles.sectionTitle}>{t('result.confirmSuggestion')}</Text>
                <RNView style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {estimate.dish_suggestions.map((suggestion) => (
                    <PressableScale
                      key={suggestion.food_id}
                      onPress={() => {
                        setSuggestionError(null);
                        suggestionMutation.mutate(suggestion.label);
                      }}
                      disabled={suggestionMutation.isPending}
                      scale={0.97}
                    >
                      <RNView style={[styles.suggestionChip, { backgroundColor: isDark ? '#004D40' : '#E6F4F1', borderColor: isDark ? '#80CBC4' : '#2AA89A' }]}>
                        <Text style={{ fontFamily: 'Nunito_700Bold', color: isDark ? '#E0F2F1' : '#006A61', fontSize: 14 }}>
                          {suggestionMutation.isPending ? t('result.checkingDish') : suggestion.label}
                        </Text>
                      </RNView>
                    </PressableScale>
                  ))}
                </RNView>
                {suggestionError ? <Text style={styles.suggestionError}>{suggestionError}</Text> : null}
              </RNView>
            )}

            <RNView style={{ marginTop: 'auto', gap: 10 }}>
              <GlowButton label="Log meal manually" glow size="xl" onPress={() => setIsManualEntry(true)} />
              <GlowButton label="Back to scanner" variant="secondary" size="xl" onPress={() => router.replace('/scan/camera')} />
              <GlowButton label={t('result.discard')} variant="ghost" size="xl" onPress={() => router.replace('/(tabs)')} />
            </RNView>
          </ScrollView>
        </RNView>
      </SafeAreaView>
    );
  }

  if (!estimate || estimate.status !== 'estimated' || editableFoods.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
        <RNView style={{ flex: 1 }}>
          <ScreenHeader title={t('result.title')} />
          <RNView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 20, color: theme.color.val }}>
              No nutrition estimate received
            </Text>
            <GlowButton label="Log meal manually" glow size="xl" onPress={() => setIsManualEntry(true)} />
            <GlowButton label="Back to scanner" variant="secondary" size="xl" onPress={() => router.replace('/scan/camera')} />
          </RNView>
        </RNView>
      </SafeAreaView>
    );
  }

  const alternativeSuggestions = (estimate.dish_suggestions || []).filter(
    (s) => s.label.toLowerCase() !== (editableFoods[0]?.name_en || '').toLowerCase(),
  );

  const confidenceScore = estimate.confidence ?? 0.85;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <RNView style={{ flex: 1 }}>
        <ScreenHeader title={t('result.title')} />

        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {/* Honest Confidence & Status Banner */}
          <RNView style={{ paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <RNView
              style={[
                styles.confidenceBadge,
                {
                  backgroundColor: confidenceScore >= 0.7
                    ? (isDark ? '#064E3B' : '#D1FAE5')
                    : (isDark ? '#451A03' : '#FEF3C7'),
                  borderColor: confidenceScore >= 0.7 ? '#10B981' : '#F59E0B',
                },
              ]}
            >
              <Text
                style={[
                  styles.confidenceText,
                  {
                    color: confidenceScore >= 0.7
                      ? (isDark ? '#6EE7B7' : '#047857')
                      : (isDark ? '#FCD34D' : '#B45309'),
                  },
                ]}
              >
                {`🎯 ${confidenceScore >= 0.7 ? 'High' : 'Estimated'} Confidence: ${Math.round(confidenceScore * 100)}%`}
              </Text>
            </RNView>
            <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: theme.colorMuted.val }}>
              {estimate.vision_mode === 'models' ? '✨ AI Perception' : 'Deterministic'}
            </Text>
          </RNView>

          {/* Carbs & Calories Summary Banner with high theme contrast */}
          <RNView style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <RNView
              style={[
                styles.carbsBanner,
                {
                  backgroundColor: isDark ? '#00332C' : '#D4F5E9',
                  borderColor: isDark ? '#006A61' : '#81C995',
                },
              ]}
            >
              <RNView>
                <Text style={[styles.carbsLabel, { color: isDark ? '#80CBC4' : '#006A61' }]}>{t('result.totalCarbs')}</Text>
                <Text style={[styles.massLabel, { color: isDark ? '#80CBC4' : '#006A61' }]}>
                  {`Mass: ${totalMass.toFixed(0)}g · Energy: ${(estimate.calories_kcal ?? editableFoods[0]?.kcal ?? 0).toFixed(0)} kcal`}
                </Text>
              </RNView>
              <Text style={[styles.carbsValue, { color: isDark ? '#A7F3D0' : '#006A61' }]}>{`${totalCarbs.toFixed(1)}g`}</Text>
            </RNView>
          </RNView>

          {/* Alternative Dish Suggestions */}
          {alternativeSuggestions.length > 0 && (
            <RNView style={{ gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}>
              <Text style={styles.sectionTitle}>Not the right dish? Choose another:</Text>
              <RNView style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {alternativeSuggestions.map((suggestion) => (
                  <PressableScale
                    key={suggestion.food_id}
                    onPress={() => {
                      setSuggestionError(null);
                      suggestionMutation.mutate(suggestion.label);
                    }}
                    disabled={suggestionMutation.isPending}
                    scale={0.97}
                  >
                    <RNView
                      style={[
                        styles.suggestionChip,
                        {
                          backgroundColor: isDark ? '#004D40' : '#E6F4F1',
                          borderColor: isDark ? '#80CBC4' : '#2AA89A',
                        },
                      ]}
                    >
                      <Text style={{ fontFamily: 'Nunito_700Bold', color: isDark ? '#E0F2F1' : '#006A61', fontSize: 13 }}>
                        {suggestionMutation.isPending ? t('result.checkingDish') : suggestion.label}
                      </Text>
                    </RNView>
                  </PressableScale>
                ))}
              </RNView>
              {suggestionError ? <Text style={styles.suggestionError}>{suggestionError}</Text> : null}
            </RNView>
          )}

          {/* Editable Food Details */}
          <RNView style={{ paddingHorizontal: 16, gap: 12 }}>
            {editableFoods.map((item, index) => (
              <AnimatedCard key={item.id} delay={index * 50}>
                <RNView style={{ gap: 12 }}>
                  <Input
                    value={item.name_en}
                    onChangeText={(value) => updateFood(item.id, 'name_en', value)}
                    height={50}
                    br={20}
                    borderWidth={1.5}
                    borderColor="$borderColor"
                    focusStyle={{ borderColor: '$primary' }}
                    fontSize="$4"
                    style={{ fontFamily: 'Nunito_700Bold', paddingHorizontal: 16 }}
                  />
                  <RNView style={{ flexDirection: 'row', gap: 12 }}>
                    <RNView style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.fieldLabel}>{t('result.portion')} (g)</Text>
                      <Input
                        value={String(item.portion_g)}
                        onChangeText={(value) => updateFood(item.id, 'portion_g', value)}
                        keyboardType="decimal-pad"
                        height={48}
                        br={18}
                        borderWidth={1.5}
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$primary' }}
                        style={{ fontFamily: 'Nunito_600SemiBold', paddingHorizontal: 14 }}
                      />
                    </RNView>
                    <RNView style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.fieldLabel}>{t('today.carbs').replace(/^./, (letter) => letter.toUpperCase())} (g)</Text>
                      <Input
                        value={String(item.carbs_g)}
                        onChangeText={(value) => updateFood(item.id, 'carbs_g', value)}
                        keyboardType="decimal-pad"
                        height={48}
                        br={18}
                        borderWidth={1.5}
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$primary' }}
                        style={{ fontFamily: 'Nunito_600SemiBold', paddingHorizontal: 14 }}
                      />
                    </RNView>
                  </RNView>
                  {editableFoods.length > 1 && (
                    <PressableScale onPress={() => deleteFood(item.id)} scale={0.95}>
                      <RNView style={styles.deleteButton}>
                        <Trash2 size={15} color="#991B1B" />
                        <Text style={styles.deleteLabel}>Remove item</Text>
                      </RNView>
                    </PressableScale>
                  )}
                </RNView>
              </AnimatedCard>
            ))}
          </RNView>

          {/* Action Buttons: Save Meal, Log Manually, Discard Meal */}
          <RNView style={{ paddingHorizontal: 16, paddingTop: 20, gap: 10 }}>
            <GlowButton
              label={t('result.save')}
              glow
              size="xl"
              onPress={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || editableFoods.length === 0}
            />
            <GlowButton
              label="Log meal manually"
              variant="secondary"
              size="xl"
              onPress={() => {
                setManualMeal({
                  name: editableFoods[0]?.name_en || '',
                  carbs: String(totalCarbs),
                  protein: String(estimate.protein_g ?? ''),
                  fat: String(estimate.fat_g ?? ''),
                  fiber: String(estimate.fiber_g ?? ''),
                });
                setIsManualEntry(true);
              }}
            />
            <GlowButton
              label={t('result.discard')}
              variant="ghost"
              size="xl"
              onPress={() => discardMutation.mutate()}
              disabled={discardMutation.isPending}
            />
          </RNView>
        </ScrollView>
      </RNView>
    </SafeAreaView>
  );
}

function MacroInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <RNView style={{ flex: 1, gap: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Input value={value} onChangeText={onChangeText} placeholder="0" keyboardType="decimal-pad" height={48} br={18} borderWidth={1.5} borderColor="$borderColor" focusStyle={{ borderColor: '$primary' }} style={styles.input} />
    </RNView>
  );
}

const styles = StyleSheet.create({
  carbsBanner: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(42, 168, 154, 0.15)' } as any : {
      shadowColor: '#2AA89A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 2,
    }),
  },
  carbsLabel: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#006A61' },
  massLabel: { fontFamily: 'Nunito_500Medium', fontSize: 12, color: '#006A61', opacity: 0.8 },
  carbsValue: { fontFamily: 'Nunito_800ExtraBold', fontSize: 24, color: '#006A61' },
  sectionTitle: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#5F6F69', textTransform: 'uppercase', letterSpacing: 0.5 },
  suggestionChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9999, borderWidth: 1, borderColor: '#2AA89A', backgroundColor: '#F2FBF8' },
  suggestionError: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#B42318' },
  approximateBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, backgroundColor: '#FFF3CD', borderWidth: 1, borderColor: '#FFB347' },
  approximateText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#B45309' },
  fieldLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#5F6F69' },
  input: { fontFamily: 'Nunito_600SemiBold', paddingHorizontal: 14 },
  calories: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: '#006A61' },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  confidenceText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
  },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 14, backgroundColor: '#FFE5D9', borderWidth: 1, borderColor: '#FF8A80' },
  deleteLabel: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#991B1B' },
});
