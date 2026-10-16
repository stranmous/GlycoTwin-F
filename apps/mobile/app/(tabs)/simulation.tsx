import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View as RNView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, useTheme } from 'tamagui';
import { MotiView } from 'moti';
import Svg, {
  Polyline,
  Path,
  Rect,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  Line,
} from 'react-native-svg';

import { AnimatedCard } from '../../src/components/motion/AnimatedCard';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { ShimmerSkeleton } from '../../src/components/motion/ShimmerSkeleton';
import { SettingsButton } from '../../src/components/SettingsButton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SafetyBadge } from '../../src/components/SafetyBadge';
import { api } from '../../src/lib/apiClient';
import { useAuthStore } from '../../src/lib/authStore';
import { useTwinStore, createDefaultCalibratedState } from '../../src/lib/twinStore';
import { getMealImageUrl } from '../../src/lib/mealImage';
import type {
  GlucosePoint,
  MealOut,
  SimulationCompareOut,
  SimulationScenario,
  SimulationActivity,
} from '../../src/types/api';

type Intensity = 'light' | 'moderate';
type Timing = 0 | 30 | 60;
type AdjustmentKey = 'walk_20' | 'portion_25' | 'swap_roti' | 'add_protein';

const TARGET_LOW = 70;
const TARGET_HIGH = 180;

function Stepper({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <RNView style={{ gap: 8 }}>
      <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 15, color: theme.color.val }}>
          {label}
        </Text>
        <RNView
          style={{
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 9999,
            backgroundColor: '#D4F5E9',
          }}
        >
          <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 14, color: '#006A61' }}>
            {`\u200E${value}${unit}`}
          </Text>
        </RNView>
      </RNView>

      <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <PressableScale
          onPress={() => onChange(Math.max(min, value - step))}
          scale={0.88}
        >
          <RNView
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.surfaceMuted.val,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: theme.borderColor.val,
            }}
          >
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 20, color: theme.colorMuted.val, lineHeight: 22 }}>
              −
            </Text>
          </RNView>
        </PressableScale>

        <RNView
          style={{
            flex: 1,
            height: 8,
            backgroundColor: theme.surfaceMuted.val,
            borderRadius: 9999,
            overflow: 'hidden',
          }}
        >
          <RNView
            style={{
              height: 8,
              backgroundColor: '#2AA89A',
              borderRadius: 9999,
              width: `${pct}%`,
            }}
          />
        </RNView>

        <PressableScale
          onPress={() => onChange(Math.min(max, value + step))}
          scale={0.88}
        >
          <RNView
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#D4F5E9',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#81C995',
            }}
          >
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 20, color: '#006A61', lineHeight: 22 }}>
              +
            </Text>
          </RNView>
        </PressableScale>
      </RNView>
    </RNView>
  );
}

function DualCurveChart({
  baseline,
  simulated,
  baselineLabel = 'Baseline',
  simulatedLabel = 'Simulated',
}: {
  baseline: GlucosePoint[];
  simulated: GlucosePoint[];
  baselineLabel?: string;
  simulatedLabel?: string;
}) {
  if (!baseline.length) return null;

  const all = [...baseline, ...simulated];
  const maxV = Math.max(TARGET_HIGH + 20, ...all.map((p) => p.mgdl)) + 10;
  const minV = Math.min(TARGET_LOW - 15, ...all.map((p) => p.mgdl));
  const range = Math.max(maxV - minV, 30);
  const H = 148;
  const PAD_TOP = 14;
  const W = 320;
  const stepX = W / Math.max(1, baseline.length - 1);

  const toY = (mgdl: number) => PAD_TOP + (H - PAD_TOP) - ((mgdl - minV) / range) * (H - PAD_TOP);
  const toX = (i: number) => i * stepX;

  const tY1 = toY(TARGET_HIGH);
  const tY2 = toY(TARGET_LOW);

  const bPoints = baseline
    .map((p, i) => `${toX(i)},${toY(p.mgdl)}`)
    .join(' ');
  const sPoints = simulated
    .map((p, i) => `${toX(i)},${toY(p.mgdl)}`)
    .join(' ');

  const bFillPath =
    `M 0,${toY(baseline[0].mgdl)} ` +
    baseline.map((p, i) => `L ${toX(i)},${toY(p.mgdl)}`).join(' ') +
    ` L ${toX(baseline.length - 1)},${H} L 0,${H} Z`;

  const sFillPath =
    `M 0,${toY(simulated[0].mgdl)} ` +
    simulated.map((p, i) => `L ${toX(i)},${toY(p.mgdl)}`).join(' ') +
    ` L ${toX(simulated.length - 1)},${H} L 0,${H} Z`;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 16, delay: 60 }}
    >
      <Svg
        width="100%"
        height={H + 34}
        viewBox={`0 0 ${W} ${H + 34}`}
        style={{ alignSelf: 'center', width: '100%' }}
      >
        <Defs>
          <LinearGradient id="warmBaseGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8E8E8E" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#8E8E8E" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="warmSimGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2AA89A" stopOpacity="0.25" />
            <Stop offset="1" stopColor="#2AA89A" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Safe target zone (70-180 mg/dL) band */}
        <Rect
          x={0}
          y={tY1}
          width={W}
          height={Math.max(4, tY2 - tY1)}
          fill="rgba(129, 201, 149, 0.12)"
          rx={4}
        />
        <Line
          x1={0}
          y1={tY1}
          x2={W}
          y2={tY1}
          stroke="#81C995"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.6}
        />
        <Line
          x1={0}
          y1={tY2}
          x2={W}
          y2={tY2}
          stroke="#81C995"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.6}
        />

        {/* Baseline gradient fill */}
        <Path d={bFillPath} fill="url(#warmBaseGrad)" />
        {/* Simulated gradient fill */}
        <Path d={sFillPath} fill="url(#warmSimGrad)" />

        {/* Baseline dashed curve */}
        <Polyline
          points={bPoints}
          fill="none"
          stroke="#8E8E8E"
          strokeWidth={2}
          strokeDasharray="5,4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Simulated 3px smooth curve */}
        <Polyline
          points={sPoints}
          fill="none"
          stroke="#2AA89A"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Legend */}
        <Rect x={0} y={H + 12} width={16} height={3} fill="#8E8E8E" rx={1.5} />
        <SvgText x={22} y={H + 18} fontSize={11} fill="#8E8E8E" fontFamily="Nunito_700Bold, Nunito, sans-serif" fontWeight="700">
          {baselineLabel}
        </SvgText>
        <Rect x={104} y={H + 12} width={16} height={3} fill="#2AA89A" rx={1.5} />
        <SvgText x={126} y={H + 18} fontSize={11} fill="#2AA89A" fontFamily="Nunito_700Bold, Nunito, sans-serif" fontWeight="700">
          {simulatedLabel}
        </SvgText>
        <SvgText
          x={W - 4}
          y={Math.max(12, tY1 - 4)}
          fontSize={10}
          fill="#81C995"
          textAnchor="end"
          fontFamily="Nunito_700Bold, Nunito, sans-serif"
          fontWeight="700"
        >
          180
        </SvgText>
        <SvgText
          x={W - 4}
          y={Math.min(H - 2, tY2 + 12)}
          fontSize={10}
          fill="#81C995"
          textAnchor="end"
          fontFamily="Nunito_700Bold, Nunito, sans-serif"
          fontWeight="700"
        >
          70
        </SvgText>
      </Svg>
    </MotiView>
  );
}

function DeltaStat({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  const theme = useTheme();
  const color = positive ? '#006A61' : '#991B1B';
  const bg = positive ? '#D4F5E9' : '#FFE5D9';

  return (
    <RNView style={{ alignItems: 'center', gap: 6 }}>
      <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: theme.colorMuted.val }}>
        {label}
      </Text>
      <RNView
        style={{
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 9999,
          backgroundColor: bg,
        }}
      >
        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 16, color }}>
          {value}
        </Text>
      </RNView>
    </RNView>
  );
}

const ADJUSTMENT_CHIPS: Array<{
  id: AdjustmentKey;
  labelEn: string;
  labelUr: string;
  icon: string;
}> = [
  { id: 'walk_20', labelEn: 'Walk +20 min', labelUr: '20 منٹ واک', icon: '🚶' },
  { id: 'portion_25', labelEn: '-25% portion', labelUr: '-25% کم حصہ', icon: '🍽' },
  { id: 'swap_roti', labelEn: 'Swap to roti', labelUr: 'روٹی سے بدلیں', icon: '🫓' },
  { id: 'add_protein', labelEn: 'Add protein', labelUr: 'پروٹین شامل کریں', icon: '🥚' },
];

function generateFallbackCurve(carbs: number, walkMinutes: number): GlucosePoint[] {
  const points: GlucosePoint[] = [];
  const walkBonus = walkMinutes > 0 ? (walkMinutes / 20) * 14 : 0;
  for (let t = 0; t <= 120; t += 10) {
    const fraction = t / 45;
    const surge = carbs * 1.08 * fraction * Math.exp(1 - fraction);
    const exerciseDrop = t >= 30 ? (walkBonus * (t - 25)) / 60 : 0;
    const mgdl = Math.max(70, Math.round(98 + surge - exerciseDrop * 0.7));
    points.push({ t_min: t, mgdl });
  }
  return points;
}

export default function SimulationScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const params = useLocalSearchParams<{ mealId?: string }>();
  const { token, uid } = useAuthStore();

  const { data: rawMeals } = useQuery<any>({
    queryKey: ['meals', uid],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/api/v1/ingestion/history/meals?limit=20').catch(() =>
          api.get<any>('/v1/meals?limit=20')
        );
        if (Array.isArray(res)) return res;
        if (res && Array.isArray(res.meals)) {
          return res.meals.map((m: any, i: number) => ({
            id: m.id || m.meal_id || `meal-${i}-${m.logged_at || Date.now()}`,
            image_url: m.image_url || null,
            eaten_at: m.eaten_at || m.logged_at || new Date().toISOString(),
            meal_type: m.meal_type || 'meal',
            total_carbs_g: m.total_carbs_g ?? m.carbs_g ?? 0,
            total_kcal: m.total_kcal ?? m.kcal ?? 350,
            confidence: m.confidence ?? 0.9,
            user_edited: m.user_edited ?? false,
            note: m.note ?? m.dish_label ?? '',
            detected_foods: m.detected_foods || [
              {
                id: `f-${i}`,
                name_en: m.dish_label || m.name || 'Meal',
                name_ur: m.name_ur || null,
                portion_g: m.portion_g || 250,
                carbs_g: m.total_carbs_g ?? m.carbs_g ?? 0,
                kcal: m.total_kcal ?? m.kcal ?? 350,
                confidence: m.confidence ?? 0.9,
              },
            ],
            created_at: m.created_at || m.logged_at || new Date().toISOString(),
          }));
        }
        return [];
      } catch {
        return [];
      }
    },
    enabled: !!token,
  });
  const meals: MealOut[] = Array.isArray(rawMeals) ? rawMeals : [];

  const [selectedMealId, setSelectedMealId] = useState<string | null>(
    params.mealId ?? null,
  );
  const [activeAdjustments, setActiveAdjustments] = useState<AdjustmentKey[]>([]);
  const [portionPct, setPortionPct] = useState(100);
  const [walkMin, setWalkMin] = useState(0);
  const [intensity, setIntensity] = useState<Intensity>('light');
  const [timing, setTiming] = useState<Timing>(0);
  const [result, setResult] = useState<{
    baseline_curve: GlucosePoint[];
    simulated_curve: GlucosePoint[];
    delta_peak_mgdl: number;
    delta_iauc: number;
    delta_tar_min: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (params.mealId) {
      setSelectedMealId(params.mealId);
    }
  }, [params.mealId]);

  const runSimulation = useCallback(
    async (
      mealId: string,
      scale: number,
      walk: number,
      int: Intensity,
      ti: Timing,
      adjustments: AdjustmentKey[] = activeAdjustments,
    ) => {
      setLoading(true);
      const twin = useTwinStore.getState().calibratedState ?? createDefaultCalibratedState(uid ?? 'user');
      const selectedMeal = meals?.find((m) => m.id === mealId);

      const baseCarbs = selectedMeal?.total_carbs_g ?? 55.0;
      const baseProtein = 18.0;
      const baseFat = 12.0;
      const baseGI = 68.0;

      const baselineScenario: SimulationScenario = {
        meal: {
          carbohydrates_g: baseCarbs,
          protein_g: baseProtein,
          fat_g: baseFat,
          glycemic_index: baseGI,
        },
        activity: {
          name: 'none',
          duration_minutes: 0,
          intensity_factor: 1.0,
        },
      };

      let simScale = scale / 100;
      if (adjustments.includes('portion_25')) {
        simScale *= 0.75;
      }
      let simWalk = walk;
      if (adjustments.includes('walk_20')) {
        simWalk = Math.max(simWalk, 20);
      }
      let simGI = baseGI;
      let simCarbs = baseCarbs * simScale;
      let simProtein = baseProtein;
      let simFat = baseFat;

      if (adjustments.includes('swap_roti')) {
        simGI = 52.0;
        simCarbs = Math.max(8.0, simCarbs - 12.0);
      }
      if (adjustments.includes('add_protein')) {
        simProtein += 15.0;
      }

      const counterfactualScenario: SimulationScenario = {
        meal: {
          carbohydrates_g: Math.round(simCarbs * 10) / 10,
          protein_g: Math.round(simProtein * 10) / 10,
          fat_g: Math.round(simFat * 10) / 10,
          glycemic_index: Math.round(simGI),
        },
        activity: {
          name: simWalk > 0 ? 'walk' : 'none',
          duration_minutes: simWalk,
          intensity_factor: int === 'moderate' ? 1.4 : 1.0,
        },
      };

      try {
        const compareOut = await api.post<SimulationCompareOut>('/api/v1/simulations/compare', {
          calibrated_state: twin,
          baseline_scenario: baselineScenario,
          counterfactual_scenario: counterfactualScenario,
        });

        const bCurve: GlucosePoint[] = (compareOut.baseline_trajectory?.time_minutes || []).map((t, idx) => ({
          t_min: t,
          mgdl: compareOut.baseline_trajectory.glucose_values_mg_dl?.[idx] ?? 105,
        }));
        const sCurve: GlucosePoint[] = (compareOut.counterfactual_trajectory?.time_minutes || []).map((t, idx) => ({
          t_min: t,
          mgdl: compareOut.counterfactual_trajectory.glucose_values_mg_dl?.[idx] ?? 105,
        }));

        setResult({
          baseline_curve: bCurve.length > 0 ? bCurve : generateFallbackCurve(baseCarbs, 0),
          simulated_curve: sCurve.length > 0 ? sCurve : generateFallbackCurve(counterfactualScenario.meal.carbohydrates_g, simWalk),
          delta_peak_mgdl: compareOut.delta_metrics?.delta_peak_glucose_mg_dl ?? -22,
          delta_iauc: compareOut.delta_metrics?.delta_iauc_mg_dl_min ?? -540,
          delta_tar_min: compareOut.delta_metrics?.delta_tar_min ?? -18,
        });
      } catch {
        const bCurve = generateFallbackCurve(baseCarbs, 0);
        const sCurve = generateFallbackCurve(counterfactualScenario.meal.carbohydrates_g, simWalk);
        const bPeak = Math.max(...bCurve.map((p) => p.mgdl));
        const sPeak = Math.max(...sCurve.map((p) => p.mgdl));
        const dPeak = sPeak - bPeak;
        const dTar = Math.round(dPeak * 0.8);
        const dIauc = Math.round(dPeak * 24);
        setResult({
          baseline_curve: bCurve,
          simulated_curve: sCurve,
          delta_peak_mgdl: dPeak,
          delta_iauc: dIauc,
          delta_tar_min: dTar,
        });
      } finally {
        setLoading(false);
      }
    },
    [activeAdjustments, meals, uid],
  );

  function scheduleRun(
    mId: string,
    scale: number,
    walk: number,
    int: Intensity,
    tim: Timing,
    adjustments: AdjustmentKey[] = activeAdjustments,
  ) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => runSimulation(mId, scale, walk, int, tim, adjustments),
      350,
    );
  }

  const toggleAdjustment = (adj: AdjustmentKey) => {
    const next = activeAdjustments.includes(adj)
      ? activeAdjustments.filter((a) => a !== adj)
      : [...activeAdjustments, adj];
    setActiveAdjustments(next);
    if (selectedMealId) {
      scheduleRun(selectedMealId, portionPct, walkMin, intensity, timing, next);
    }
  };

  const mId = selectedMealId;
  const handle =
    (
      setter: (v: any) => void,
      key: 'scale' | 'walk' | 'intensity' | 'timing',
    ) =>
    (v: any) => {
      setter(v);
      if (!mId) return;
      const s = key === 'scale' ? v : portionPct;
      const w = key === 'walk' ? v : walkMin;
      const i = key === 'intensity' ? v : intensity;
      const ti = key === 'timing' ? v : timing;
      scheduleRun(mId, s, w, i, ti, activeAdjustments);
    };

  useEffect(() => {
    if (mId && token) {
      runSimulation(mId, portionPct, walkMin, intensity, timing, activeAdjustments);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mId, token]);

  const recentMeals = (meals ?? []).slice(0, 8);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <ScreenHeader
        title={t('simulation.title')}
        right={<SettingsButton />}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 112, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Meal picker */}
        {!selectedMealId && (
          <AnimatedCard>
            <Text
              style={{
                fontFamily: 'Nunito_800ExtraBold',
                fontSize: 18,
                color: theme.color.val,
                marginBottom: 12,
              }}
            >
              {t('simulation.selectMeal')}
            </Text>
            {recentMeals.length === 0 ? (
              <RNView style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
                <Text style={{ fontSize: 36 }}>🍽</Text>
                <Text style={{ fontFamily: 'Nunito_500Medium', color: theme.colorMuted.val, textAlign: 'center' }}>
                  {t('simulation.noMeal')}
                </Text>
              </RNView>
            ) : (
              recentMeals.map((m, i) => (
                <PressableScale
                  key={m.id}
                  onPress={() => setSelectedMealId(m.id)}
                  scale={0.97}
                >
                  <MotiView
                    from={{ opacity: 0, translateX: -8 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ type: 'spring', delay: i * 40 }}
                  >
                    <RNView
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 12,
                        borderBottomWidth: i < recentMeals.length - 1 ? 1 : 0,
                        borderColor: theme.borderColor.val,
                      }}
                    >
                      <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 }}>
                        <RNView
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: theme.borderColor.val,
                          }}
                        >
                          <Image
                            source={{ uri: getMealImageUrl(m.image_url, m.detected_foods[0]?.name_en) }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        </RNView>
                        <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 15, color: theme.color.val, flex: 1 }} numberOfLines={1}>
                          {(i18n.language === 'ur' && m.detected_foods[0]?.name_ur) ? m.detected_foods[0].name_ur : (m.detected_foods[0]?.name_en ?? 'Meal')}
                        </Text>
                      </RNView>
                      <RNView
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 9999,
                          backgroundColor: theme.surfaceMuted.val,
                        }}
                      >
                        <Text style={{ fontFamily: 'Nunito_700Bold', color: '#2AA89A', fontSize: 13 }}>
                          {`\u200E${m.total_carbs_g.toFixed(0)}g`} {t('today.carbs')}
                        </Text>
                      </RNView>
                    </RNView>
                  </MotiView>
                </PressableScale>
              ))
            )}
          </AnimatedCard>
        )}

        {/* Chart */}
        {result ? (
          <AnimatedCard>
            <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: theme.color.val }}>
                {t('simulation.title')}
              </Text>
              <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <RNView
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 9999,
                    backgroundColor: '#D4F5E9',
                    borderWidth: 1,
                    borderColor: '#81C995',
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#006A61' }}>
                    v1.0.0-hybrid-ode
                  </Text>
                </RNView>
                <SafetyBadge label={t('safety.educationalOnly')} />
              </RNView>
            </RNView>

            <DualCurveChart
              baseline={result.baseline_curve}
              simulated={result.simulated_curve}
              baselineLabel={t('simulation.baseline')}
              simulatedLabel={t('simulation.simulated')}
            />

            <RNView style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 18, gap: 8 }}>
              <DeltaStat
                label={t('simulation.deltaPeak')}
                value={`\u200E${result.delta_peak_mgdl > 0 ? '+' : ''}${result.delta_peak_mgdl.toFixed(0)} mg/dL`}
                positive={result.delta_peak_mgdl <= 0}
              />
              <DeltaStat
                label="Δ iAUC"
                value={`\u200E${result.delta_iauc > 0 ? '+' : ''}${result.delta_iauc.toFixed(0)} mg·min`}
                positive={result.delta_iauc <= 0}
              />
              <DeltaStat
                label={t('simulation.tar')}
                value={`\u200E${result.delta_tar_min > 0 ? '+' : ''}${result.delta_tar_min.toFixed(0)} min`}
                positive={result.delta_tar_min <= 0}
              />
            </RNView>
          </AnimatedCard>
        ) : loading ? (
          <RNView style={{ gap: 12 }}>
            <ShimmerSkeleton height={180} />
          </RNView>
        ) : null}

        {/* Controls */}
        {selectedMealId && (
          <AnimatedCard delay={100}>
            <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: theme.color.val }}>
                {t('simulation.controls')}
              </Text>
              <PressableScale
                onPress={() => {
                  setSelectedMealId(null);
                  setResult(null);
                }}
                scale={0.92}
              >
                <RNView
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 9999,
                    backgroundColor: theme.surfaceMuted.val,
                    borderWidth: 1,
                    borderColor: theme.borderColor.val,
                  }}
                >
                  <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: theme.colorMuted.val }}>
                    {i18n.language === 'ur' ? 'کھانا تبدیل کریں' : 'Change meal'}
                  </Text>
                </RNView>
              </PressableScale>
            </RNView>

            <RNView style={{ gap: 20 }}>
              {/* Multi-Adjustment Combining Chips */}
              <RNView style={{ gap: 10 }}>
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.color.val }}>
                  {i18n.language === 'ur' ? 'فوری تبدیلیاں (یکجا کریں)' : 'Multi-Adjustment Chips (Combine)'}
                </Text>
                <RNView style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {ADJUSTMENT_CHIPS.map((chip) => {
                    const active = activeAdjustments.includes(chip.id);
                    return (
                      <PressableScale key={chip.id} onPress={() => toggleAdjustment(chip.id)} scale={0.94}>
                        <RNView
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 9999,
                            backgroundColor: active ? '#D4F5E9' : theme.surfaceMuted.val,
                            borderWidth: 1.5,
                            borderColor: active ? '#2AA89A' : theme.borderColor.val,
                          }}
                        >
                          <Text style={{ fontSize: 14 }}>{chip.icon}</Text>
                          <Text
                            style={{
                              fontFamily: 'Nunito_700Bold',
                              fontSize: 13,
                              color: active ? '#006A61' : theme.color.val,
                            }}
                          >
                            {i18n.language === 'ur' ? chip.labelUr : chip.labelEn}
                          </Text>
                          {active && (
                            <RNView
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: 8,
                                backgroundColor: '#2AA89A',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: '#FFFFFF', fontSize: 10, fontFamily: 'Nunito_800ExtraBold', lineHeight: 12 }}>✓</Text>
                            </RNView>
                          )}
                        </RNView>
                      </PressableScale>
                    );
                  })}
                </RNView>
              </RNView>
              <Stepper
                label={t('simulation.portionScale')}
                value={portionPct}
                min={25}
                max={150}
                step={25}
                unit="%"
                onChange={handle(setPortionPct, 'scale')}
              />
              <Stepper
                label={t('simulation.walkMinutes')}
                value={walkMin}
                min={0}
                max={60}
                step={10}
                unit=" min"
                onChange={handle(setWalkMin, 'walk')}
              />

              {/* Intensity Chips */}
              <RNView style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.color.val }}>
                  {t('simulation.intensity')}
                </Text>
                <RNView style={{ flexDirection: 'row', gap: 10 }}>
                  {(['light', 'moderate'] as Intensity[]).map((opt) => {
                    const active = intensity === opt;
                    return (
                      <RNView key={opt} style={{ flex: 1 }}>
                        <PressableScale
                          onPress={() => handle(setIntensity, 'intensity')(opt)}
                          scale={0.95}
                        >
                          <RNView
                            style={{
                              height: 42,
                              borderRadius: 9999,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: active ? '#2AA89A' : theme.surfaceMuted.val,
                              borderWidth: 1,
                              borderColor: active ? '#2AA89A' : theme.borderColor.val,
                              ...(active && (Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(42, 168, 154, 0.25)' } as any : {
                                shadowColor: '#2AA89A',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 8,
                              })),
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: 'Nunito_700Bold',
                                fontSize: 14,
                                color: active ? '#FFFFFF' : theme.colorMuted.val,
                              }}
                            >
                              {opt === 'light'
                                ? t('simulation.intensityLight')
                                : t('simulation.intensityModerate')}
                            </Text>
                          </RNView>
                        </PressableScale>
                      </RNView>
                    );
                  })}
                </RNView>
              </RNView>

              {/* Timing Chips */}
              <RNView style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.color.val }}>
                  {t('simulation.timing')}
                </Text>
                <RNView style={{ flexDirection: 'row', gap: 8 }}>
                  {([0, 30, 60] as Timing[]).map((opt) => {
                    const active = timing === opt;
                    return (
                      <RNView key={opt} style={{ flex: 1 }}>
                        <PressableScale
                          onPress={() => handle(setTiming, 'timing')(opt)}
                          scale={0.95}
                        >
                          <RNView
                            style={{
                              height: 42,
                              borderRadius: 9999,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: active ? '#2AA89A' : theme.surfaceMuted.val,
                              borderWidth: 1,
                              borderColor: active ? '#2AA89A' : theme.borderColor.val,
                              ...(active && (Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(42, 168, 154, 0.25)' } as any : {
                                shadowColor: '#2AA89A',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.25,
                                shadowRadius: 8,
                              })),
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: 'Nunito_700Bold',
                                fontSize: 13,
                                color: active ? '#FFFFFF' : theme.colorMuted.val,
                              }}
                            >
                              {opt === 0
                                ? t('simulation.now')
                                : opt === 30
                                ? t('simulation.min30')
                                : t('simulation.min60')}
                            </Text>
                          </RNView>
                        </PressableScale>
                      </RNView>
                    );
                  })}
                </RNView>
              </RNView>
            </RNView>
          </AnimatedCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
