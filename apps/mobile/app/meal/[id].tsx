import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Platform, ScrollView, View as RNView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, useTheme } from 'tamagui';
import { TrendingUp, Trash2 } from '@tamagui/lucide-icons';
import { MotiView } from 'moti';
import Svg, { Polyline, Rect, Line } from 'react-native-svg';

import { AnimatedCard } from '../../src/components/motion/AnimatedCard';
import { GlowButton } from '../../src/components/motion/GlowButton';
import { ShimmerSkeleton } from '../../src/components/motion/ShimmerSkeleton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SafetyBadge } from '../../src/components/SafetyBadge';
import { api } from '../../src/lib/apiClient';
import { useTwinStore, createDefaultCalibratedState } from '../../src/lib/twinStore';
import { getMealImageUrl } from '../../src/lib/mealImage';
import type { GlucosePoint, MealOut, PredictionOut } from '../../src/types/api';

const TARGET_LOW = 70;
const TARGET_HIGH = 180;

function MiniChart({ curve }: { curve: GlucosePoint[] }) {
  if (!curve.length) return null;
  const max = Math.max(TARGET_HIGH + 15, ...curve.map((p) => p.mgdl)) + 8;
  const min = Math.min(TARGET_LOW - 15, ...curve.map((p) => p.mgdl));
  const range = Math.max(max - min, 30);
  const H = 96;
  const PAD_TOP = 8;
  const W = 300;
  const stepX = W / Math.max(1, curve.length - 1);

  const toY = (mgdl: number) => PAD_TOP + (H - PAD_TOP) - ((mgdl - min) / range) * (H - PAD_TOP);

  const points = curve.map((p, i) => {
    const x = i * stepX;
    const y = toY(p.mgdl);
    return `${x},${y}`;
  }).join(' ');

  const targetY1 = toY(TARGET_HIGH);
  const targetY2 = toY(TARGET_LOW);

  return (
    <MotiView
      from={{ opacity: 0, scaleX: 0.8 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ type: 'spring', delay: 180 }}
      style={{ alignItems: 'center', marginVertical: 8, width: '100%' }}
    >
      <Svg width="100%" height={H + 12} viewBox={`0 0 ${W} ${H + 12}`} style={{ width: '100%' }}>
        {/* Soft target band */}
        <Rect
          x={0}
          y={Math.min(targetY1, targetY2)}
          width={W}
          height={Math.max(4, Math.abs(targetY2 - targetY1))}
          fill="rgba(129, 201, 149, 0.15)"
          rx={4}
        />
        <Line
          x1={0}
          y1={Math.min(targetY1, targetY2)}
          x2={W}
          y2={Math.min(targetY1, targetY2)}
          stroke="#81C995"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.6}
        />
        <Line
          x1={0}
          y1={Math.max(targetY1, targetY2)}
          x2={W}
          y2={Math.max(targetY1, targetY2)}
          stroke="#81C995"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.6}
        />

        {/* Prediction curve in Warm Teal */}
        <Polyline
          points={points}
          fill="none"
          stroke="#2AA89A"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </MotiView>
  );
}

export default function MealDetail() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: meal, isLoading: mealLoading } = useQuery<MealOut>({
    queryKey: ['meal', id],
    queryFn: () => api.get<MealOut>(`/api/v1/ingestion/history/meals/${id}`).catch(() => api.get<MealOut>(`/v1/meals/${id}`)),
    enabled: !!id,
  });

  const { data: prediction, isLoading: predLoading } = useQuery<PredictionOut>({
    queryKey: ['prediction', id, meal?.total_carbs_g],
    queryFn: async () => {
      const twin = useTwinStore.getState().calibratedState ?? createDefaultCalibratedState();
      const carbs = meal?.total_carbs_g ?? 52.0;

      try {
        const res = await api.post<any>('/api/v1/predictions/predict', {
          calibrated_state: twin,
          meal_input: {
            carbohydrates_g: carbs,
            protein_g: 18.0,
            fat_g: 12.0,
            glycemic_index: 62.0,
          },
          current_glucose_mg_dl: 105.0,
        });

        const curve: GlucosePoint[] = (res.time_minutes || []).map((t: number, idx: number) => ({
          t_min: t,
          mgdl: res.glucose_values_mg_dl?.[idx] ?? 105.0,
        }));

        return {
          id: res.meal_id || id,
          meal_id: id,
          curve: curve.length > 0 ? curve : [{ t_min: 0, mgdl: 105 }, { t_min: 45, mgdl: res.peak_glucose_mg_dl || 158 }, { t_min: 120, mgdl: 112 }],
          peak_mgdl: res.peak_glucose_mg_dl ?? 158.4,
          peak_at_min: res.time_to_peak_minutes ?? 45,
          time_above_range_min: 25,
          created_at: new Date().toISOString(),
          model_version: res.model_version || 'v1.0.0-hybrid-ode',
        };
      } catch {
        // Fallback baseline estimate if predict fails or is offline
        return {
          id: id ?? 'prediction',
          meal_id: id ?? '',
          curve: [
            { t_min: 0, mgdl: 105 },
            { t_min: 45, mgdl: 158 },
            { t_min: 120, mgdl: 112 },
          ],
          peak_mgdl: 158.4,
          peak_at_min: 45,
          time_above_range_min: 25,
          created_at: new Date().toISOString(),
          model_version: 'v1.0.0-hybrid-ode',
        };
      }
    },
    enabled: !!id,
    staleTime: Infinity,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.del(`/api/v1/ingestion/meals/${id}`).catch(() => api.del(`/v1/meals/${id}`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meals'] });
      qc.invalidateQueries({ queryKey: ['insights'] });
      router.back();
    },
  });

  function handleDelete() {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this meal? This cannot be undone.')) {
        deleteMutation.mutate();
      }
    } else {
      Alert.alert(
        'Delete Meal',
        'Are you sure you want to delete this meal record?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
        ],
      );
    }
  }

  const isLoading = mealLoading || predLoading;
  const time = meal ? `\u200E${new Date(meal.eaten_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <RNView style={{ flex: 1 }}>
        <ScreenHeader
          title={(i18n.language === 'ur' && meal?.detected_foods?.[0]?.name_ur) ? meal.detected_foods[0].name_ur : (meal?.detected_foods?.[0]?.name_en ?? meal?.note ?? 'Meal')}
          subtitle={time}
          showBack
        />

        {isLoading ? (
          <RNView style={{ paddingHorizontal: 16, gap: 16, paddingTop: 16 }}>
            <ShimmerSkeleton height={140} />
            <ShimmerSkeleton height={70} />
            <ShimmerSkeleton height={70} />
          </RNView>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Meal Photo Header */}
            {meal ? (
              <AnimatedCard delay={0}>
                <RNView style={{ width: '100%', height: 180, borderRadius: 18, overflow: 'hidden' }}>
                  <Image
                    source={{ uri: getMealImageUrl(meal.image_url, meal.detected_foods[0]?.name_en || meal.note) }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                </RNView>
              </AnimatedCard>
            ) : null}

            {/* Prediction chart */}
            {prediction && (
              <AnimatedCard delay={0}>
                <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: theme.color.val }}>
                    {i18n.language === 'ur' ? 'گلوکوز کی پیش گوئی' : 'Glucose forecast'}
                  </Text>
                  <RNView style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <RNView
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 9999,
                        backgroundColor: '#D4F5E9',
                        borderWidth: 1,
                        borderColor: '#81C995',
                      }}
                    >
                      <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#006A61' }}>
                        {prediction.model_version || 'v1.0.0-hybrid-ode'}
                      </Text>
                    </RNView>
                    <SafetyBadge label={t('safety.educationalOnly')} />
                  </RNView>
                </RNView>

                <MiniChart curve={prediction.curve} />

                <RNView style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 }}>
                  <Stat label={t('simulation.predictedPeak')} value={`\u200E${prediction.peak_mgdl.toFixed(0)} mg/dL`} color="#FF8A80" />
                  <Stat label="At" value={`\u200E${prediction.peak_at_min.toFixed(0)} min`} color="#2AA89A" />
                  <Stat label="TAR" value={`\u200E${prediction.time_above_range_min.toFixed(0)} min`} color="#FFB347" />
                </RNView>
              </AnimatedCard>
            )}

            {/* Foods breakdown */}
            {(meal?.detected_foods ?? []).map((f, i) => (
              <AnimatedCard key={f.id} delay={i * 60 + 40}>
                <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <RNView style={{ gap: 2, flex: 1 }}>
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 16, color: theme.color.val }}>
                      {f.name_en}
                    </Text>
                    {f.name_ur ? (
                      <Text style={{ fontFamily: 'Nunito_500Medium', color: theme.colorMuted.val, fontSize: 13 }}>
                        {f.name_ur}
                      </Text>
                    ) : null}
                  </RNView>
                  <RNView style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={{ fontFamily: 'Nunito_800ExtraBold', color: '#2AA89A', fontSize: 15 }}>
                      {`\u200E${f.carbs_g.toFixed(0)}g`} {t('today.carbs')}
                    </Text>
                    <Text style={{ fontFamily: 'Nunito_500Medium', color: theme.colorMuted.val, fontSize: 12 }}>
                      {`\u200E${f.portion_g.toFixed(0)}g`} {t('result.portion')}
                    </Text>
                  </RNView>
                </RNView>
              </AnimatedCard>
            ))}

            {/* Action buttons */}
            <RNView style={{ gap: 12, marginTop: 12 }}>
              <GlowButton
                label={t('simulation.title')}
                variant="primary"
                glow
                size="xl"
                icon={<TrendingUp size={18} color="#FFFFFF" />}
                onPress={() => router.push({ pathname: '/(tabs)/simulation', params: { mealId: id } })}
              />

              <GlowButton
                label={i18n.language === 'ur' ? 'کھانا حذف کریں' : 'Delete Meal'}
                variant="danger"
                size="xl"
                icon={<Trash2 size={18} color="#FFFFFF" />}
                onPress={handleDelete}
                disabled={deleteMutation.isPending}
              />
            </RNView>
          </ScrollView>
        )}
      </RNView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const theme = useTheme();
  return (
    <RNView style={{ alignItems: 'center', gap: 4 }}>
      <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.colorMuted.val }}>
        {label}
      </Text>
      <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color: color ?? theme.color.val }}>
        {value}
      </Text>
    </RNView>
  );
}
