import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';
import { MotiView } from 'moti';
import { BarChart2 } from '@tamagui/lucide-icons';

import { AnimatedCard } from '../../src/components/motion/AnimatedCard';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { ShimmerSkeleton } from '../../src/components/motion/ShimmerSkeleton';
import { SettingsButton } from '../../src/components/SettingsButton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { api } from '../../src/lib/apiClient';
import { useAuthStore } from '../../src/lib/authStore';
import type { InsightCard, InsightsSummary } from '../../src/types/api';

type Window = 'today' | '7d' | '30d';
const WINDOWS: Window[] = ['today', '7d', '30d'];

const COLOR_IN = '#2DD4BF';    // Stitch mint — in range
const COLOR_ABOVE = '#FFB24C'; // Stitch amber — above range
const COLOR_BELOW = '#F43F5E'; // Stitch rose — below range

function TirGaugeMultiColor({
  inRange,
  above,
  below,
}: {
  inRange: number;
  above: number;
  below: number;
}) {
  const { Svg, Circle } = require('react-native-svg');
  const SIZE = 220;
  const CX = SIZE / 2;
  const R = (SIZE - 32) / 2;
  const C = 2 * Math.PI * R;

  const inLen = (inRange / 100) * C;
  const aboveLen = (above / 100) * C;
  const belowLen = (below / 100) * C;

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.75 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 14, stiffness: 130, delay: 120 }}
      style={{ alignItems: 'center' }}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Track */}
        <Circle
          cx={CX}
          cy={CX}
          r={R}
          fill="none"
          stroke="rgba(186,202,197,0.25)"
          strokeWidth={18}
        />
        {/* In-range (green) */}
        {inLen > 0 && (
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={COLOR_IN}
            strokeWidth={16}
            strokeDasharray={`${inLen} 9999`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CX})`}
          />
        )}
        {/* Above-range (orange) */}
        {aboveLen > 0 && (
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={COLOR_ABOVE}
            strokeWidth={16}
            strokeDasharray={`${aboveLen} 9999`}
            strokeDashoffset={-inLen}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CX})`}
          />
        )}
        {/* Below-range (red) */}
        {belowLen > 0 && (
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={COLOR_BELOW}
            strokeWidth={16}
            strokeDasharray={`${belowLen} 9999`}
            strokeDashoffset={-(inLen + aboveLen)}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CX})`}
          />
        )}
      </Svg>
      <View
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        ai="center"
        jc="center"
        gap="$1"
      >
        <Text
          fontSize="$10"
          fontWeight="800"
          color="$success"
         
        >
          {inRange.toFixed(0)}%
        </Text>
        <Text fontSize="$3" color="$colorMuted" fontWeight="600">
          in range
        </Text>
      </View>
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
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', delay: 200 }}
    >
      <View ai="center" gap="$2">
        <View
          px="$3"
          py="$2"
          br="$3"
          bg={bgColor}
          minWidth={72}
          ai="center"
        >
          <Text fontSize="$6" fontWeight="800" color={color}>
            {pct.toFixed(0)}%
          </Text>
        </View>
        <Text fontSize="$3" color="$colorMuted" fontWeight="500">
          {label}
        </Text>
      </View>
    </MotiView>
  );
}

function CardBadge({ severity }: { severity: InsightCard['severity'] }) {
  const color =
    severity === 'good' ? '$success' : severity === 'warn' ? '$warn' : '$primary';
  return <View width={4} bg={color} br="$7" alignSelf="stretch" />;
}

function InsightCardItem({
  card,
  delay,
}: {
  card: InsightCard;
  delay: number;
}) {
  const { i18n } = useTranslation();
  const isUr = i18n.language === 'ur';
  return (
    <AnimatedCard delay={delay}>
      <View fd="row" gap="$3" ai="stretch">
        <CardBadge severity={card.severity} />
        <View f={1} gap="$1">
          <Text fontWeight="700" fontSize="$4">
            {isUr && card.title_ur ? card.title_ur : card.title_en}
          </Text>
          <Text color="$colorMuted" fontSize="$3" lineHeight={18}>
            {isUr && card.body_ur ? card.body_ur : card.body_en}
          </Text>
        </View>
      </View>
    </AnimatedCard>
  );
}

export default function Insights() {
  const { t } = useTranslation();
  const [window, setWindow] = useState<Window>('today');
  const { token, uid } = useAuthStore();

  const { data, isLoading } = useQuery<InsightsSummary>({
    queryKey: ['insights', uid, window],
    queryFn: () => api.get(`/v1/insights/summary?window=${window}`),
    enabled: !!token,
  });

  const windowLabel = (w: Window) =>
    ({
      today: t('insights.windowToday'),
      '7d': t('insights.window7d'),
      '30d': t('insights.window30d'),
    }[w]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background">
        <ScreenHeader
          title={t('insights.title')}
          right={<SettingsButton />}
        />

        {/* Window selector — pill chips */}
        <View fd="row" px="$4" pb="$3" gap="$2">
          {WINDOWS.map((w) => (
            <View key={w} f={1}>
              <PressableScale onPress={() => setWindow(w)} scale={0.94}>
                <View
                  py="$2"
                  br="$8"
                  ai="center"
                  bg={window === w ? '$primary' : '$surfaceMuted'}
                  borderWidth={1.5}
                  borderColor={window === w ? '$primary' : 'transparent'}
                  style={window === w ? {
                    shadowColor: 'rgba(45,212,191,0.4)',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 1,
                    shadowRadius: 8,
                    elevation: 4,
                  } : undefined}
                >
                  <Text
                    fontSize="$3"
                    fontWeight="700"
                    color={window === w ? '$onPrimary' : '$colorMuted'}
                    style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
                  >
                    {windowLabel(w)}
                  </Text>
                </View>
              </PressableScale>
            </View>
          ))}
        </View>

        {isLoading ? (
          <View px="$4" gap="$4">
            <View ai="center">
              <ShimmerSkeleton height={220} width={220} radius={110} />
            </View>
            <ShimmerSkeleton height={80} />
            <ShimmerSkeleton height={80} />
          </View>
        ) : !data || data.tir.sample_count === 0 ? (
          <View f={1} ai="center" jc="center" px="$6">
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', delay: 80 }}
            >
              <View
                width={84}
                height={84}
                borderRadius={42}
                bg="rgba(45,212,191,0.12)"
                borderWidth={1.5}
                borderColor="rgba(45,212,191,0.25)"
                ai="center"
                jc="center"
                mb="$4"
                style={{
                  shadowColor: 'rgba(45,212,191,0.3)',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 1,
                  shadowRadius: 16,
                }}
              >
                <BarChart2 size={36} color="#2DD4BF" />
              </View>
            </MotiView>
            <Text color="$colorMuted" ta="center" fontSize="$4">
              {t('insights.noData')}
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* TIR Gauge card */}
            <AnimatedCard>
              <Text
                fontWeight="800"
                fontSize="$5"
                mb="$4"
                style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
              >
                {t('insights.tirTitle')}
              </Text>
              <View ai="center">
                <TirGaugeMultiColor
                  inRange={data.tir.in_range_pct}
                  above={data.tir.above_range_pct}
                  below={data.tir.below_range_pct}
                />
              </View>
              <View fd="row" jc="space-around" mt="$5">
                <TirBand
                  label={t('insights.inRange')}
                  pct={data.tir.in_range_pct}
                  color={COLOR_IN}
                  bgColor="rgba(16,185,129,0.12)"
                />
                <TirBand
                  label={t('insights.above')}
                  pct={data.tir.above_range_pct}
                  color={COLOR_ABOVE}
                  bgColor="rgba(249,115,22,0.12)"
                />
                <TirBand
                  label={t('insights.below')}
                  pct={data.tir.below_range_pct}
                  color={COLOR_BELOW}
                  bgColor="rgba(239,68,68,0.12)"
                />
              </View>
              <View mt="$3" ai="center">
                <Text fontSize="$3" color="$colorMuted">
                  {t('insights.tirRange')} · {data.tir.sample_count} readings
                </Text>
              </View>
            </AnimatedCard>

            {/* Top spike meals */}
            {data.top_spike_meals.length > 0 && (
              <AnimatedCard delay={80}>
                <Text
                  fontWeight="800"
                  fontSize="$5"
                  mb="$3"
                  style={{ fontFamily: 'PlusJakartaSans_800ExtraBold' }}
                >
                  {t('insights.topSpikes')}
                </Text>
                {data.top_spike_meals.map((m, i) => (
                  <View
                    key={m.meal_id}
                    fd="row"
                    ai="center"
                    jc="space-between"
                    py="$3"
                    borderBottomWidth={
                      i < data.top_spike_meals.length - 1 ? 1 : 0
                    }
                    borderColor="$borderColor"
                  >
                    <View fd="row" ai="center" gap="$3" f={1}>
                      <View
                        width={28}
                        height={28}
                        borderRadius={14}
                        bg="rgba(249,115,22,0.15)"
                        ai="center"
                        jc="center"
                      >
                        <Text
                          fontSize="$3"
                          fontWeight="700"
                          color="$warn"
                        >
                          {i + 1}
                        </Text>
                      </View>
                      <Text f={1} numberOfLines={1}>
                        {m.label}
                      </Text>
                    </View>
                    <View
                      px="$2"
                      py="$1"
                      br="$2"
                      bg="rgba(249,115,22,0.12)"
                    >
                      <Text
                        color="$warn"
                        fontWeight="700"
                        fontSize="$3"
                       
                      >
                        {m.peak_mgdl.toFixed(0)} mg/dL
                      </Text>
                    </View>
                  </View>
                ))}
              </AnimatedCard>
            )}

            {/* Insight cards */}
            {data.cards.map((card, i) => (
              <InsightCardItem
                key={card.id}
                card={card}
                delay={i * 60 + 140}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
