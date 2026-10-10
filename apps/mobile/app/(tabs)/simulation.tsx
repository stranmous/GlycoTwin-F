import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';
import { MotiView } from 'moti';

import { AnimatedCard } from '../../src/components/motion/AnimatedCard';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { ShimmerSkeleton } from '../../src/components/motion/ShimmerSkeleton';
import { SettingsButton } from '../../src/components/SettingsButton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SafetyBadge } from '../../src/components/SafetyBadge';
import { api } from '../../src/lib/apiClient';
import { useAuthStore } from '../../src/lib/authStore';
import type { GlucosePoint, MealOut, SimulationOut } from '../../src/types/api';

type Intensity = 'light' | 'moderate';
type Timing = 0 | 30 | 60;

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
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <View gap="$2">
      <View fd="row" jc="space-between" ai="center">
        <Text fontSize="$4" color="$colorMuted" fontWeight="500">
          {label}
        </Text>
        <View px="$3" py="$1" br="$3" bg="$primarySoft">
          <Text fontSize="$4" fontWeight="700" color="$primary">
            {value}
            {unit}
          </Text>
        </View>
      </View>
      <View fd="row" ai="center" gap="$3">
        <PressableScale
          onPress={() => onChange(Math.max(min, value - step))}
          scale={0.88}
        >
          <View
            width={38}
            height={38}
            br="$8"
            bg="$surfaceMuted"
            ai="center"
            jc="center"
            borderWidth={1.5}
            borderColor="$borderColor"
          >
            <Text fontSize="$6" fontWeight="700" color="$colorMuted">
              −
            </Text>
          </View>
        </PressableScale>
        <View f={1} height={6} bg="$surfaceMuted" br="$8" overflow="hidden">
          <View
            height={6}
            bg="$primary"
            br="$8"
            width={`${pct}%` as any}
            style={{
              shadowColor: 'rgba(45,212,191,0.5)',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 1,
              shadowRadius: 6,
            }}
          />
        </View>
        <PressableScale
          onPress={() => onChange(Math.min(max, value + step))}
          scale={0.88}
        >
          <View
            width={38}
            height={38}
            br="$8"
            bg="$primarySoft"
            ai="center"
            jc="center"
            borderWidth={1.5}
            borderColor="$primary"
            style={{
              shadowColor: 'rgba(45,212,191,0.3)',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 1,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Text fontSize="$6" fontWeight="700" color="$primary">
              +
            </Text>
          </View>
        </PressableScale>
      </View>
    </View>
  );
}

function DualCurveChart({
  baseline,
  simulated,
}: {
  baseline: GlucosePoint[];
  simulated: GlucosePoint[];
}) {
  if (!baseline.length) return null;

  const all = [...baseline, ...simulated];
  const maxV = Math.max(...all.map((p) => p.mgdl));
  const minV = Math.min(TARGET_LOW - 20, ...all.map((p) => p.mgdl));
  const range = Math.max(maxV - minV, 30);
  const H = 140;
  const W = 320;
  const stepX = W / (baseline.length - 1);

  const toY = (mgdl: number) => H - ((mgdl - minV) / range) * H;
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

  const {
    Svg,
    Polyline,
    Path,
    Rect,
    Defs,
    LinearGradient,
    Stop,
    Text: SvgText,
    Line,
  } = require('react-native-svg');

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 16, delay: 60 }}
    >
      <Svg
        width={W}
        height={H + 32}
        viewBox={`0 0 ${W} ${H + 32}`}
        style={{ alignSelf: 'center' }}
      >
        <Defs>
          <LinearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#94A3B8" stopOpacity="0.20" />
            <Stop offset="1" stopColor="#94A3B8" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2DD4BF" stopOpacity="0.30" />
            <Stop offset="1" stopColor="#2DD4BF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Target band */}
        <Rect
          x={0}
          y={tY1}
          width={W}
          height={tY2 - tY1}
          fill="rgba(45,212,191,0.08)"
        />
        <Line
          x1={0}
          y1={tY1}
          x2={W}
          y2={tY1}
          stroke="#2DD4BF"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.5}
        />
        <Line
          x1={0}
          y1={tY2}
          x2={W}
          y2={tY2}
          stroke="#2DD4BF"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.5}
        />

        {/* Baseline gradient fill */}
        <Path d={bFillPath} fill="url(#baseGrad)" />
        {/* Simulated gradient fill */}
        <Path d={sFillPath} fill="url(#simGrad)" />

        {/* Baseline line */}
        <Polyline
          points={bPoints}
          fill="none"
          stroke="#94A3B8"
          strokeWidth={2}
          strokeDasharray="6,4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Simulated line */}
        <Polyline
          points={sPoints}
          fill="none"
          stroke="#2DD4BF"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Legend */}
        <Rect x={0} y={H + 10} width={16} height={3} fill="#94A3B8" rx="1.5" />
        <SvgText x={20} y={H + 20} fontSize={10} fill="#94A3B8" fontWeight="600">
          Baseline
        </SvgText>
        <Rect x={90} y={H + 10} width={16} height={3} fill="#2DD4BF" rx="1.5" />
        <SvgText x={110} y={H + 20} fontSize={10} fill="#2DD4BF" fontWeight="600">
          Simulated
        </SvgText>
        <SvgText
          x={W - 4}
          y={tY1 - 3}
          fontSize={9}
          fill="#2DD4BF"
          textAnchor="end"
          opacity={0.8}
        >
          180
        </SvgText>
        <SvgText
          x={W - 4}
          y={tY2 + 10}
          fontSize={9}
          fill="#2DD4BF"
          textAnchor="end"
          opacity={0.8}
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
  const color = positive ? '#2DD4BF' : '#FFB24C';
  const bg = positive ? 'rgba(45,212,191,0.12)' : 'rgba(255,178,76,0.12)';
  return (
    <View ai="center" gap="$2">
      <Text fontSize="$3" color="$colorMuted" fontWeight="500">
        {label}
      </Text>
      <View px="$3" py="$2" br="$3" bg={bg}>
        <Text fontSize="$5" fontWeight="800" color={color}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function SimulationScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mealId?: string }>();
  const { token, uid } = useAuthStore();

  const { data: meals } = useQuery<MealOut[]>({
    queryKey: ['meals', uid],
    queryFn: () => api.get('/v1/meals?limit=20'),
    enabled: !!token,
  });

  const [selectedMealId, setSelectedMealId] = useState<string | null>(
    params.mealId ?? null,
  );
  const [portionPct, setPortionPct] = useState(100);
  const [walkMin, setWalkMin] = useState(0);
  const [intensity, setIntensity] = useState<Intensity>('light');
  const [timing, setTiming] = useState<Timing>(0);
  const [result, setResult] = useState<SimulationOut | null>(null);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSimulation = useCallback(
    async (
      mealId: string,
      scale: number,
      walk: number,
      int: Intensity,
      t: Timing,
    ) => {
      setLoading(true);
      try {
        const out = await api.post<SimulationOut>('/v1/simulations/what-if', {
          meal_id: mealId,
          inputs: {
            portion_scale: scale / 100,
            walk_minutes: walk,
            intensity: int,
            timing_offset_min: t,
          },
        });
        setResult(out);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  function scheduleRun(
    mId: string,
    scale: number,
    walk: number,
    int: Intensity,
    tim: Timing,
  ) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => runSimulation(mId, scale, walk, int, tim),
      600,
    );
  }

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
      scheduleRun(mId, s, w, i, ti);
    };

  useEffect(() => {
    if (mId) scheduleRun(mId, portionPct, walkMin, intensity, timing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mId]);

  const recentMeals = (meals ?? []).slice(0, 8);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background">
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
            <AnimatedCard tone="subtle">
              <Text fontWeight="800" fontSize="$5" mb="$3">
                {t('simulation.selectMeal')}
              </Text>
              {recentMeals.length === 0 ? (
                <View ai="center" py="$4" gap="$3">
                  <Text fontSize="$8">🍽</Text>
                  <Text color="$colorMuted" ta="center">
                    {t('simulation.noMeal')}
                  </Text>
                </View>
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
                      transition={{ type: 'spring', delay: i * 50 }}
                    >
                      <View
                        fd="row"
                        ai="center"
                        jc="space-between"
                        py="$3"
                        borderBottomWidth={i < recentMeals.length - 1 ? 1 : 0}
                        borderColor="$borderColor"
                      >
                        <View fd="row" ai="center" gap="$3">
                          <View
                            width={10}
                            height={10}
                            borderRadius={5}
                            bg="$primary"
                            opacity={0.5 + i * 0.06}
                          />
                          <Text fontWeight="600">
                            {m.detected_foods[0]?.name_en ?? 'Meal'}
                          </Text>
                        </View>
                        <View px="$2" py="$1" br="$2" bg="$primarySoft">
                          <Text
                            color="$primary"
                            fontSize="$3"
                            fontWeight="700"
                           
                          >
                            {m.total_carbs_g.toFixed(0)}g carbs
                          </Text>
                        </View>
                      </View>
                    </MotiView>
                  </PressableScale>
                ))
              )}
            </AnimatedCard>
          )}

          {/* Chart */}
          {result ? (
            <AnimatedCard tone="subtle">
              <View fd="row" jc="space-between" ai="center" mb="$3">
                <Text fontWeight="800" fontSize="$5">
                  {t('simulation.title')}
                </Text>
                <SafetyBadge label={t('safety.educationalOnly')} />
              </View>
              <DualCurveChart
                baseline={result.baseline_curve}
                simulated={result.simulated_curve}
              />
              <View fd="row" jc="space-around" mt="$4">
                <DeltaStat
                  label={t('simulation.deltaPeak')}
                  value={`${result.delta_peak_mgdl > 0 ? '+' : ''}${result.delta_peak_mgdl.toFixed(0)} mg/dL`}
                  positive={result.delta_peak_mgdl < 0}
                />
                <DeltaStat
                  label={t('simulation.tar')}
                  value={`${result.delta_tar_min > 0 ? '+' : ''}${result.delta_tar_min.toFixed(0)} min`}
                  positive={result.delta_tar_min < 0}
                />
              </View>
            </AnimatedCard>
          ) : loading ? (
            <View gap="$3">
              <MotiView
                from={{ opacity: 0.4 }}
                animate={{ opacity: 1 }}
                transition={{
                  type: 'timing',
                  duration: 800,
                  loop: true,
                  repeatReverse: true,
                }}
              >
                <View
                  bg="$surface"
                  br="$4"
                  p="$4"
                  borderWidth={1}
                  borderColor="$borderColor"
                  gap="$3"
                >
                  <ShimmerSkeleton height={140} />
                  <View fd="row" jc="space-around">
                    <ShimmerSkeleton height={52} width="40%" />
                    <ShimmerSkeleton height={52} width="40%" />
                  </View>
                </View>
              </MotiView>
            </View>
          ) : null}

          {/* Controls */}
          {selectedMealId && (
            <AnimatedCard delay={120} tone="subtle">
              <View fd="row" jc="space-between" ai="center" mb="$4">
                <Text fontWeight="800" fontSize="$5">
                  {t('simulation.controls')}
                </Text>
                {selectedMealId && (
                  <PressableScale
                    onPress={() => {
                      setSelectedMealId(null);
                      setResult(null);
                    }}
                    scale={0.9}
                  >
                    <View
                      px="$3"
                      py="$1"
                      br="$3"
                      bg="$surfaceMuted"
                      borderWidth={1}
                      borderColor="$borderColor"
                    >
                      <Text fontSize="$3" color="$colorMuted" fontWeight="600">
                        Change meal
                      </Text>
                    </View>
                  </PressableScale>
                )}
              </View>
              <View gap="$5">
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

                <View gap="$2">
                  <Text fontSize="$4" color="$colorMuted" fontWeight="600"
                    style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                    {t('simulation.intensity')}
                  </Text>
                  <View fd="row" gap="$2">
                    {(['light', 'moderate'] as Intensity[]).map((opt) => (
                      <View key={opt} f={1}>
                        <PressableScale
                          onPress={() =>
                            handle(setIntensity, 'intensity')(opt)
                          }
                          scale={0.94}
                        >
                          <View
                            py="$3"
                            br="$8"
                            ai="center"
                            bg={intensity === opt ? '$primary' : '$surfaceMuted'}
                            borderWidth={1.5}
                            borderColor={
                              intensity === opt ? '$primary' : 'transparent'
                            }
                            style={intensity === opt ? {
                              shadowColor: 'rgba(45,212,191,0.4)',
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 1,
                              shadowRadius: 8,
                              elevation: 4,
                            } : undefined}
                          >
                            <Text
                              color={intensity === opt ? '$onPrimary' : '$colorMuted'}
                              fontWeight="700"
                              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
                            >
                              {opt === 'light'
                                ? t('simulation.intensityLight')
                                : t('simulation.intensityModerate')}
                            </Text>
                          </View>
                        </PressableScale>
                      </View>
                    ))}
                  </View>
                </View>

                <View gap="$2">
                  <Text fontSize="$4" color="$colorMuted" fontWeight="600"
                    style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                    {t('simulation.timing')}
                  </Text>
                  <View fd="row" gap="$2">
                    {([0, 30, 60] as Timing[]).map((opt) => (
                      <View key={opt} f={1}>
                        <PressableScale
                          onPress={() => handle(setTiming, 'timing')(opt)}
                          scale={0.94}
                        >
                          <View
                            py="$3"
                            br="$8"
                            ai="center"
                            bg={timing === opt ? '$primary' : '$surfaceMuted'}
                            borderWidth={1.5}
                            borderColor={
                              timing === opt ? '$primary' : 'transparent'
                            }
                            style={timing === opt ? {
                              shadowColor: 'rgba(45,212,191,0.4)',
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 1,
                              shadowRadius: 8,
                              elevation: 4,
                            } : undefined}
                          >
                            <Text
                              color={timing === opt ? '$onPrimary' : '$colorMuted'}
                              fontWeight="700"
                              fontSize="$3"
                              style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
                            >
                              {opt === 0
                                ? t('simulation.now')
                                : opt === 30
                                ? t('simulation.min30')
                                : t('simulation.min60')}
                            </Text>
                          </View>
                        </PressableScale>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </AnimatedCard>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
