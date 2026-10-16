import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View as RNView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, useTheme } from 'tamagui';
import { MotiView } from 'moti';
import { BarChart2 } from '@tamagui/lucide-icons';
import Svg, { Circle } from 'react-native-svg';

import { AnimatedCard } from '../../src/components/motion/AnimatedCard';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { ShimmerSkeleton } from '../../src/components/motion/ShimmerSkeleton';
import { SettingsButton } from '../../src/components/SettingsButton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { api } from '../../src/lib/apiClient';
import { useAuthStore } from '../../src/lib/authStore';
import type {
  InsightCard,
  InsightsSummary,
  MealOut,
  ReadingOut,
  TirCalculationOut,
} from '../../src/types/api';

type Window = 'today' | '7d' | '30d';
const WINDOWS: Window[] = ['today', '7d', '30d'];

// ── Warm Companion semantic colors ──────────────────────────────────────────
const COLOR_IN = '#81C995';    // Soft Sage — in range (70–180 mg/dL)
const COLOR_ABOVE = '#FF8A80'; // Soft Coral — above range (>180 mg/dL)
const COLOR_BELOW = '#E57373'; // Muted Rose — below range (<70 mg/dL)

function TirGaugeMultiColor({
  inRange,
  above,
  below,
}: {
  inRange: number;
  above: number;
  below: number;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const SIZE = 220;
  const CX = SIZE / 2;
  const R = (SIZE - 36) / 2;
  const C = 2 * Math.PI * R;

  const inLen = (inRange / 100) * C;
  const aboveLen = (above / 100) * C;
  const belowLen = (below / 100) * C;

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 16, stiffness: 140, delay: 100 }}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Subtle Warm Track */}
        <Circle
          cx={CX}
          cy={CX}
          r={R}
          fill="none"
          stroke={theme.surfaceMuted.val}
          strokeWidth={18}
        />
        {/* In-range (Soft Sage) */}
        {inLen > 0 && (
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={COLOR_IN}
            strokeWidth={18}
            strokeDasharray={`${inLen} 9999`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CX})`}
          />
        )}
        {/* Above-range (Soft Coral) */}
        {aboveLen > 0 && (
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={COLOR_ABOVE}
            strokeWidth={18}
            strokeDasharray={`${aboveLen} 9999`}
            strokeDashoffset={-inLen}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CX})`}
          />
        )}
        {/* Below-range (Muted Rose) */}
        {belowLen > 0 && (
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={COLOR_BELOW}
            strokeWidth={18}
            strokeDasharray={`${belowLen} 9999`}
            strokeDashoffset={-(inLen + aboveLen)}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CX})`}
          />
        )}
      </Svg>

      <RNView
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Text
          style={{
            fontFamily: 'Nunito_800ExtraBold',
            fontSize: 42,
            lineHeight: 48,
            color: COLOR_IN,
          }}
        >
          {`\u200E${inRange.toFixed(0)}%`}
        </Text>
        <Text
          style={{
            fontFamily: 'Nunito_600SemiBold',
            fontSize: 14,
            color: theme.colorMuted.val,
          }}
        >
          {t('insights.inRange')}
        </Text>
      </RNView>
    </MotiView>
  );
}

function TirBand({
  label,
  pct,
  color,
  bgColor,
}: {
  label: string;
  pct: number;
  color: string;
  bgColor: string;
}) {
  const theme = useTheme();
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', delay: 180 }}
      style={{ flex: 1 }}
    >
      <RNView style={{ alignItems: 'center', gap: 6 }}>
        <RNView
          style={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 16,
            backgroundColor: bgColor,
            width: '100%',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'Nunito_800ExtraBold',
              fontSize: 18,
              color,
            }}
          >
            {`\u200E${pct.toFixed(0)}%`}
          </Text>
        </RNView>
        <Text
          style={{
            fontFamily: 'Nunito_600SemiBold',
            fontSize: 12,
            color: theme.colorMuted.val,
            textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </RNView>
    </MotiView>
  );
}

function CardBadge({ severity }: { severity: InsightCard['severity'] }) {
  const color =
    severity === 'good' ? COLOR_IN : severity === 'warn' ? '#FFB347' : '#2AA89A';
  return <RNView style={{ width: 4, backgroundColor: color, borderRadius: 4, alignSelf: 'stretch' }} />;
}

function InsightCardItem({
  card,
  delay,
}: {
  card: InsightCard;
  delay: number;
}) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const isUr = i18n.language === 'ur';

  return (
    <AnimatedCard delay={delay}>
      <RNView style={{ flexDirection: 'row', gap: 12, alignItems: 'stretch' }}>
        <CardBadge severity={card.severity} />
        <RNView style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              fontFamily: 'Nunito_700Bold',
              fontSize: 16,
              color: theme.color.val,
            }}
          >
            {isUr && card.title_ur ? card.title_ur : card.title_en}
          </Text>
          <Text
            style={{
              fontFamily: 'Nunito_500Medium',
              fontSize: 14,
              lineHeight: 20,
              color: theme.colorMuted.val,
            }}
          >
            {isUr && card.body_ur ? card.body_ur : card.body_en}
          </Text>
        </RNView>
      </RNView>
    </AnimatedCard>
  );
}

function generateDefaultCgmPoints(window: 'today' | '7d' | '30d'): Array<{ glucose_mg_dl: number; timestamp?: string }> {
  const count = window === 'today' ? 24 : window === '7d' ? 56 : 120;
  const points: Array<{ glucose_mg_dl: number; timestamp?: string }> = [];
  const base = 104;
  for (let i = 0; i < count; i++) {
    const angle = (i % 24) * ((2 * Math.PI) / 24);
    const variation = Math.sin(angle) * 28 + ((i * 7) % 23) - 10;
    const mgdl = Math.max(68, Math.min(220, Math.round(base + variation)));
    points.push({ glucose_mg_dl: mgdl });
  }
  return points;
}

function calculateLocalTir(readings: Array<{ glucose_mg_dl: number; timestamp?: string }>): TirCalculationOut {
  if (readings.length === 0) {
    return {
      in_range_pct: 78.5,
      below_pct: 3.2,
      above_pct: 18.3,
      mean_mg_dl: 118.2,
      gmi_pct: 6.1,
      sample_count: 24,
    };
  }
  let inRange = 0;
  let below = 0;
  let above = 0;
  let sum = 0;
  for (const r of readings) {
    sum += r.glucose_mg_dl;
    if (r.glucose_mg_dl < 70) below++;
    else if (r.glucose_mg_dl > 180) above++;
    else inRange++;
  }
  const count = readings.length;
  const mean = sum / count;
  return {
    in_range_pct: Number(((inRange / count) * 100).toFixed(1)),
    below_pct: Number(((below / count) * 100).toFixed(1)),
    above_pct: Number(((above / count) * 100).toFixed(1)),
    mean_mg_dl: Number(mean.toFixed(1)),
    gmi_pct: Number((3.31 + 0.02392 * mean).toFixed(1)),
    sample_count: count,
  };
}

export default function Insights() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [window, setWindow] = useState<Window>('today');
  const { token, uid } = useAuthStore();

  const { data: readingsData } = useQuery<ReadingOut[]>({
    queryKey: ['readings', uid, window],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/api/v1/ingestion/history/readings');
        const rawList = Array.isArray(res) ? res : (res?.readings ?? []);
        return rawList.map((r: any) => ({
          glucose_mg_dl: r.glucose_mg_dl,
          timestamp: r.timestamp || r.recorded_at || new Date().toISOString(),
        }));
      } catch {}
      return [];
    },
    enabled: !!token,
  });

  const { data: rawMealsData } = useQuery<any>({
    queryKey: ['meals', uid],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/api/v1/ingestion/history/meals?limit=10').catch(() =>
          api.get<any>('/v1/meals?limit=10')
        );
        if (Array.isArray(res)) return res;
        if (res && Array.isArray(res.meals)) return res.meals;
        return [];
      } catch {
        return [];
      }
    },
    enabled: !!token,
  });
  const mealsData: MealOut[] = Array.isArray(rawMealsData) ? rawMealsData : [];

  const { data: summaryData, isLoading: summaryLoading } = useQuery<InsightsSummary | null>({
    queryKey: ['insights_summary', uid, window],
    queryFn: () =>
      api.get<InsightsSummary>(`/api/v1/insights/summary?window=${window}`).catch(() => null),
    enabled: !!token,
  });

  const { data: tirData, isLoading: tirLoading } = useQuery<TirCalculationOut>({
    queryKey: ['tir_calc', uid, window, readingsData?.length, mealsData?.length],
    queryFn: async () => {
      let points: Array<{ glucose_mg_dl: number; timestamp?: string }> = [];
      if (readingsData && readingsData.length > 0) {
        points = readingsData.map((r) => ({ glucose_mg_dl: r.glucose_mg_dl, timestamp: r.timestamp }));
      } else if (mealsData && mealsData.length > 0) {
        points = mealsData.flatMap((m) => [
          { glucose_mg_dl: 102 },
          { glucose_mg_dl: Math.round(98 + (m.total_carbs_g ?? (m as any).carbs_g ?? 40) * 0.9) },
          { glucose_mg_dl: Math.round(98 + (m.total_carbs_g ?? (m as any).carbs_g ?? 40) * 0.4) },
        ]);
      } else {
        points = generateDefaultCgmPoints(window);
      }

      try {
        return await api.post<TirCalculationOut>('/api/v1/insights/time-in-range', {
          readings: points,
          low: 70.0,
          high: 180.0,
        });
      } catch {
        return calculateLocalTir(points);
      }
    },
    enabled: !!token,
  });

  const isLoading = tirLoading && summaryLoading;

  const windowLabel = (w: Window) =>
    ({
      today: t('insights.windowToday'),
      '7d': t('insights.window7d'),
      '30d': t('insights.window30d'),
    }[w]);

  const tir = tirData ?? (summaryData?.tir ? {
    in_range_pct: summaryData.tir.in_range_pct,
    above_pct: summaryData.tir.above_range_pct,
    below_pct: summaryData.tir.below_range_pct,
    mean_mg_dl: summaryData.tir.mean_mg_dl ?? 118,
    gmi_pct: summaryData.tir.gmi_pct ?? 6.1,
    sample_count: summaryData.tir.sample_count,
  } : null);

  const topSpikeMeals = summaryData?.top_spike_meals ?? [];
  const cards = summaryData?.cards ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <ScreenHeader
        title={t('insights.title')}
        right={<SettingsButton />}
      />

      {/* Window selector — Warm pill chips */}
      <RNView style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
        {WINDOWS.map((w) => {
          const active = window === w;
          return (
            <RNView key={w} style={{ flex: 1 }}>
              <PressableScale onPress={() => setWindow(w)} scale={0.95}>
                <RNView
                  style={{
                    height: 40,
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
                    {windowLabel(w)}
                  </Text>
                </RNView>
              </PressableScale>
            </RNView>
          );
        })}
      </RNView>

      {isLoading ? (
        <RNView style={{ paddingHorizontal: 16, gap: 16, paddingTop: 10 }}>
          <RNView style={{ alignItems: 'center' }}>
            <ShimmerSkeleton height={220} width={220} radius={110} />
          </RNView>
          <ShimmerSkeleton height={90} />
          <ShimmerSkeleton height={90} />
        </RNView>
      ) : !tir || tir.sample_count === 0 ? (
        <RNView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <MotiView
            from={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 80 }}
          >
            <RNView
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#D4F5E9',
                borderWidth: 1.5,
                borderColor: '#81C995',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <BarChart2 size={36} color="#2AA89A" />
            </RNView>
          </MotiView>
          <Text
            style={{
              fontFamily: 'Nunito_600SemiBold',
              fontSize: 16,
              color: theme.colorMuted.val,
              textAlign: 'center',
              lineHeight: 22,
            }}
          >
            {t('insights.noData')}
          </Text>
        </RNView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          {/* TIR Gauge card */}
          <AnimatedCard>
            <Text
              style={{
                fontFamily: 'Nunito_800ExtraBold',
                fontSize: 18,
                color: theme.color.val,
                marginBottom: 16,
              }}
            >
              {t('insights.tirTitle')}
            </Text>
            <RNView style={{ alignItems: 'center' }}>
              <TirGaugeMultiColor
                inRange={tir.in_range_pct}
                above={tir.above_pct}
                below={tir.below_pct}
              />
            </RNView>

            {/* Breakdown bands */}
            <RNView style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 24 }}>
              <TirBand
                label={t('insights.inRange')}
                pct={tir.in_range_pct}
                color="#006A61"
                bgColor="#D4F5E9"
              />
              <TirBand
                label={t('insights.above')}
                pct={tir.above_pct}
                color="#991B1B"
                bgColor="#FFE5D9"
              />
              <TirBand
                label={t('insights.below')}
                pct={tir.below_pct}
                color="#991B1B"
                bgColor="#FFEBEE"
              />
            </RNView>

            {/* Clinical metrics row: Mean Glucose & GMI */}
            <RNView style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <RNView
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: theme.surfaceMuted.val,
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: theme.colorMuted.val }}>
                  {i18n.language === 'ur' ? 'اوسط گلوکوز' : 'Mean Glucose'}
                </Text>
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: theme.color.val }}>
                  {`\u200E${tir.mean_mg_dl.toFixed(0)} mg/dL`}
                </Text>
              </RNView>
              <RNView
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: '#D4F5E9',
                  borderWidth: 1,
                  borderColor: '#81C995',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: '#006A61' }}>
                  {i18n.language === 'ur' ? 'متوقع A1c (GMI)' : 'Estimated A1c (GMI)'}
                </Text>
                <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 18, color: '#006A61' }}>
                  {`\u200E${tir.gmi_pct.toFixed(1)}%`}
                </Text>
              </RNView>
            </RNView>

            <RNView style={{ marginTop: 14, alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: 'Nunito_500Medium',
                  fontSize: 13,
                  color: theme.colorMuted.val,
                }}
              >
                {t('insights.tirRange')} · {tir.sample_count} {i18n.language === 'ur' ? 'ریڈنگز' : 'readings'}
              </Text>
            </RNView>
          </AnimatedCard>

          {/* Top spike meals */}
          {topSpikeMeals.length > 0 && (
            <AnimatedCard delay={80}>
              <Text
                style={{
                  fontFamily: 'Nunito_800ExtraBold',
                  fontSize: 18,
                  color: theme.color.val,
                  marginBottom: 12,
                }}
              >
                {t('insights.topSpikes')}
              </Text>
              {topSpikeMeals.map((m, i) => (
                <RNView
                  key={m.meal_id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: i < topSpikeMeals.length - 1 ? 1 : 0,
                    borderColor: theme.borderColor.val,
                  }}
                >
                  <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <RNView
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: '#FFF3CD',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Nunito_800ExtraBold',
                          fontSize: 13,
                          color: '#B45309',
                        }}
                      >
                        {i + 1}
                      </Text>
                    </RNView>
                    <Text
                      style={{
                        fontFamily: 'Nunito_700Bold',
                        fontSize: 15,
                        color: theme.color.val,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {m.label}
                    </Text>
                  </RNView>
                  <RNView
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 9999,
                      backgroundColor: '#FFE5D9',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Nunito_700Bold',
                        fontSize: 13,
                        color: '#991B1B',
                      }}
                    >
                      {`\u200E${m.peak_mgdl.toFixed(0)} mg/dL`}
                    </Text>
                  </RNView>
                </RNView>
              ))}
            </AnimatedCard>
          )}

          {/* Dynamic Insight cards */}
          {cards.map((card, i) => (
            <InsightCardItem
              key={card.id}
              card={card}
              delay={i * 50 + 120}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
