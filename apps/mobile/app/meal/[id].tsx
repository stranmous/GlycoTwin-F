import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';
import { TrendingUp } from '@tamagui/lucide-icons';
import { MotiView } from 'moti';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AnimatedCard } from '../../src/components/motion/AnimatedCard';
import { GlowButton } from '../../src/components/motion/GlowButton';
import { ShimmerSkeleton } from '../../src/components/motion/ShimmerSkeleton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SafetyBadge } from '../../src/components/SafetyBadge';
import { api } from '../../src/lib/apiClient';
import type { GlucosePoint, MealOut, PredictionOut } from '../../src/types/api';

const TARGET_LOW = 70;
const TARGET_HIGH = 180;

function MiniChart({ curve }: { curve: GlucosePoint[] }) {
  if (!curve.length) return null;
  const max = Math.max(...curve.map((p) => p.mgdl));
  const min = Math.min(...curve.map((p) => p.mgdl));
  const range = Math.max(max - min, 30);
  const H = 80;
  const W = 280;
  const stepX = W / (curve.length - 1);

  // Build a simple polyline in SVG
  const points = curve.map((p, i) => {
    const x = i * stepX;
    const y = H - ((p.mgdl - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');

  const { Svg, Polyline, Rect } = require('react-native-svg');

  const targetY1 = H - ((TARGET_HIGH - min) / range) * H;
  const targetY2 = H - ((TARGET_LOW - min) / range) * H;

  return (
    <MotiView
      from={{ opacity: 0, scaleX: 0.8 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ type: 'spring', delay: 200 }}
    >
      <Svg width={W} height={H + 8} viewBox={`0 0 ${W} ${H + 8}`}>
        {/* Target band */}
        <Rect
          x={0}
          y={Math.min(targetY1, targetY2)}
          width={W}
          height={Math.abs(targetY2 - targetY1)}
          fill="rgba(16,185,129,0.15)"
        />
        {/* Curve */}
        <Polyline
          points={points}
          fill="none"
          stroke="#0F766E"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </MotiView>
  );
}

export default function MealDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: meal, isLoading: mealLoading } = useQuery<MealOut>({
    queryKey: ['meal', id],
    queryFn: () => api.get(`/v1/meals/${id}`),
    enabled: !!id,
  });

  const { data: prediction, isLoading: predLoading } = useQuery<PredictionOut>({
    queryKey: ['prediction', id],
    queryFn: () => api.post('/v1/predictions/baseline', { meal_id: id }),
    enabled: !!id,
    staleTime: Infinity,
  });

  const isLoading = mealLoading || predLoading;
  const time = meal ? new Date(meal.eaten_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background">
        <ScreenHeader
          title={meal?.detected_foods[0]?.name_en ?? 'Meal'}
          subtitle={time}
        />

        {isLoading ? (
          <View px="$4" gap="$4">
            <ShimmerSkeleton height={90} />
            <ShimmerSkeleton height={40} />
            <ShimmerSkeleton height={40} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {/* Prediction chart */}
            {prediction && (
              <AnimatedCard delay={0}>
                <View fd="row" jc="space-between" ai="center" mb="$3">
                  <Text fontWeight="700" fontSize="$5">Glucose forecast</Text>
                  <SafetyBadge label={t('safety.educationalOnly')} />
                </View>
                <MiniChart curve={prediction.curve} />
                <View fd="row" jc="space-between" mt="$3">
                  <Stat label="Peak" value={`${prediction.peak_mgdl.toFixed(0)} mg/dL`} />
                  <Stat label="At" value={`${prediction.peak_at_min.toFixed(0)} min`} />
                  <Stat label="TAR" value={`${prediction.time_above_range_min.toFixed(0)} min`} />
                </View>
              </AnimatedCard>
            )}

            {/* Foods */}
            {(meal?.detected_foods ?? []).map((f, i) => (
              <AnimatedCard key={f.id} delay={i * 60}>
                <View fd="row" jc="space-between" ai="center">
                  <View>
                    <Text fontWeight="600" fontSize="$5">{f.name_en}</Text>
                    {f.name_ur ? <Text color="$colorMuted" fontSize="$3">{f.name_ur}</Text> : null}
                  </View>
                  <View ai="flex-end">
                    <Text color="$primary" fontWeight="700">{f.carbs_g.toFixed(0)}g carbs</Text>
                    <Text color="$colorMuted" fontSize="$3">{f.portion_g.toFixed(0)}g portion</Text>
                  </View>
                </View>
              </AnimatedCard>
            ))}

            <GlowButton
              label={t('simulation.title')}
              variant="secondary"
              icon={<TrendingUp size={18} />}
              onPress={() => router.push({ pathname: '/(tabs)/simulation', params: { mealId: id } })}
            />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View ai="center" gap="$1">
      <Text fontSize="$3" color="$colorMuted">{label}</Text>
      <Text fontSize="$5" fontWeight="700">{value}</Text>
    </View>
  );
}
