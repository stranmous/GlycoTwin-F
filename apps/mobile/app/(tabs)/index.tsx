import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, Platform, ScrollView, StyleSheet, View as RNView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, useTheme } from 'tamagui';
import { ChevronRight, Flame, Utensils, Trash2 } from '@tamagui/lucide-icons';
import { MotiView } from 'moti';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, withDelay, Easing,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { ShimmerSkeleton } from '../../src/components/motion/ShimmerSkeleton';
import { SettingsButton } from '../../src/components/SettingsButton';
import { LogoLockup } from '../../src/components/Logo';
import { api } from '../../src/lib/apiClient';
import { useAuthStore } from '../../src/lib/authStore';
import type { MealOut, UserOut } from '../../src/types/api';

// ── Carb tier ────────────────────────────────────────────────────────────────
function carbTier(carbs: number) {
  if (carbs < 30) return { accent: '#2DD4BF', bg: 'rgba(45,212,191,0.15)', label: 'Low' };
  if (carbs < 60) return { accent: '#FFB24C', bg: 'rgba(255,178,76,0.15)', label: 'Mod' };
  return { accent: '#F43F5E', bg: 'rgba(244,63,94,0.15)', label: 'High' };
}

// ── Pulsing live dot ──────────────────────────────────────────────────────────
function LiveDot({ color = '#62F4F1' }: { color?: string }) {
  const s = useSharedValue(1);
  const o = useSharedValue(0.7);
  useEffect(() => {
    s.value = withRepeat(withTiming(2.2, { duration: 1100, easing: Easing.bezier(0.2, 0, 0.8, 1) }), -1, true);
    o.value = withRepeat(withTiming(0, { duration: 1100 }), -1, true);
  }, []);
  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: o.value,
  }));
  return (
    <RNView style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 5, backgroundColor: color }, ring]} />
      <RNView style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </RNView>
  );
}

// ── Hero card — CGM terminal aesthetic ───────────────────────────────────────
function HeroCard({ meals, userName }: { meals: MealOut[]; userName?: string }) {
  const { t } = useTranslation();
  const totalCarbs = meals.reduce((s, m) => s + m.total_carbs_g, 0);
  const totalKcal = meals.reduce((s, m) => s + m.total_kcal, 0);
  const hour = new Date().getHours();
  const greetingBase =
    hour < 12 ? t('today.goodMorning') :
    hour < 17 ? t('today.goodAfternoon') :
    t('today.goodEvening');
  const greeting = userName ? `${greetingBase}, ${userName}` : greetingBase;
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Animated scan line
  const scanX = useSharedValue(-1);
  useEffect(() => {
    scanX.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 2600, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
        withTiming(-0.1, { duration: 0 }),
      ),
      -1,
    );
  }, []);
  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scanX.value * 340 }],
  }));

  return (
    <RNView style={styles.heroMoti}>
    <MotiView
      from={{ opacity: 0, translateY: -24 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 16, stiffness: 140, delay: 40 }}
      style={{ flex: 1 }}
    >
      <RNView style={styles.heroWrapper}>
        {/* Multi-stop gradient background */}
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#0D2137" />
              <Stop offset="0.4" stopColor="#004D5C" />
              <Stop offset="0.75" stopColor="#005C4B" />
              <Stop offset="1" stopColor="#003330" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#hg)" rx="22" />
          <Path d="M0,60 L400,60" stroke="rgba(98,244,241,0.06)" strokeWidth="1" />
          <Path d="M0,120 L400,120" stroke="rgba(98,244,241,0.04)" strokeWidth="1" />
          <Path d="M100,0 L100,200" stroke="rgba(98,244,241,0.04)" strokeWidth="1" />
          <Path d="M230,0 L230,200" stroke="rgba(98,244,241,0.04)" strokeWidth="1" />
        </Svg>

        {/* Animated scan line */}
        <Animated.View style={[styles.scanLine, scanStyle]}>
          <Svg width={60} height="100%" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id="sl" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="rgba(98,244,241,0)" />
                <Stop offset="0.5" stopColor="rgba(98,244,241,0.12)" />
                <Stop offset="1" stopColor="rgba(98,244,241,0)" />
              </LinearGradient>
            </Defs>
            <Rect width="60" height="100%" fill="url(#sl)" />
          </Svg>
        </Animated.View>

        {/* Content wrapper with zIndex to prevent SVG overlap issues on web */}
        <RNView style={{ position: 'relative', zIndex: 10, flex: 1, justifyContent: 'space-between' }}>
          <RNView>
            <Text style={styles.heroGreeting}>{greeting}</Text>
            <Text style={styles.heroDate}>{dateStr}</Text>
          </RNView>

          {/* Stats */}
          <RNView style={styles.statsRow}>
            <HeroStat value={String(meals.length)} label={t('today.meals')} accent="#62F4F1" />
            <RNView style={styles.statDivider} />
            <HeroStat value={`${totalCarbs.toFixed(0)}g`} label={t('today.carbs')} accent="#A7FF3F" />
            <RNView style={styles.statDivider} />
            <HeroStat value={totalKcal.toFixed(0)} label={t('today.kcal')} accent="#FFB24C" />
          </RNView>
        </RNView>
      </RNView>
    </MotiView>
    </RNView>
  );
}

function HeroStat({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <RNView style={styles.heroStat}>
      <Text style={[styles.heroStatValue, { color: accent }]}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label.toUpperCase()}</Text>
    </RNView>
  );
}

// ── Meal card — precision instrument row ──────────────────────────────────────
function MealCard({ meal, delay, onPress, onDelete }: { meal: MealOut; delay: number; onPress: () => void; onDelete?: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const name = meal.detected_foods[0]?.name_en ?? 'Meal';
  const extra = meal.detected_foods.length > 1 ? ` +${meal.detected_foods.length - 1}` : '';
  const time = new Date(meal.eaten_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const tier = carbTier(meal.total_carbs_g);
  const [imageError, setImageError] = useState(false);

  return (
    <MotiView
      from={{ opacity: 0, translateX: -16 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 170, delay }}
    >
      <PressableScale onPress={onPress}>
        <RNView
          style={[styles.mealCard, {
            backgroundColor: theme.surface.val,
            borderColor: theme.borderColor.val,
            ...(Platform.OS === 'web' ? { boxShadow: '0 4px 20px rgba(0,0,0,0.06)' } as any : {
              shadowColor: 'rgba(0,0,0,0.08)',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 1,
              shadowRadius: 12,
            }),
          }]}
        >
        {/* Left accent bar — color-coded by carb tier */}
        <RNView style={[styles.cardAccent, { backgroundColor: tier.accent }]} />

        <RNView style={styles.cardBody}>
          {/* Icon */}
          <RNView style={[styles.foodIcon, { backgroundColor: tier.bg, overflow: 'hidden' }]}>
            {meal.image_url && !imageError ? (
              <Image 
                source={{ uri: meal.image_url.replace('localhost', Platform.OS === 'android' ? '10.0.2.2' : 'localhost') }} 
                style={{ width: '100%', height: '100%' }} 
                resizeMode="cover" 
                onError={() => setImageError(true)}
              />
            ) : (
              <Utensils size={18} color={tier.accent} />
            )}
          </RNView>

          {/* Content */}
          <RNView style={styles.cardContent}>
            <RNView style={styles.cardTop}>
              <Text style={[styles.mealName, { color: theme.color.val }]} numberOfLines={1}>
                {name}
                {extra ? <Text style={styles.mealExtra}>{extra}</Text> : null}
              </Text>
              {/* Time badge */}
              <RNView style={[styles.timeBadge, { borderColor: theme.borderColor.val }]}>
                <Text style={[styles.timeText, { color: theme.colorMuted.val }]}>{time}</Text>
              </RNView>
            </RNView>

            <RNView style={styles.cardMeta}>
              {/* Carb pill */}
              <RNView style={[styles.carbPill, { backgroundColor: tier.bg }]}>
                <Text style={[styles.carbText, { color: tier.accent }]}>
                  {meal.total_carbs_g.toFixed(0)}g {t('today.carbs')}
                </Text>
              </RNView>
              {/* Kcal */}
              <RNView style={styles.kcalRow}>
                <Flame size={11} color={theme.colorMuted.val} />
                <Text style={[styles.kcalText, { color: theme.colorMuted.val }]}>
                  {meal.total_kcal.toFixed(0)}
                </Text>
              </RNView>
            </RNView>
          </RNView>

          <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {onDelete && (
              <Pressable onPress={(e) => { e.stopPropagation(); onDelete(); }} style={{ padding: 4 }}>
                <Trash2 size={18} color="#F43F5E" opacity={0.8} />
              </Pressable>
            )}
            <ChevronRight size={16} color={theme.colorMuted.val} />
          </RNView>
        </RNView>
      </RNView>
    </PressableScale>
  </MotiView>
);
}

// ── Empty state — radar scanner ───────────────────────────────────────────────
function ScanRing({ size, delay, color }: { size: number; delay: number; color: string }) {
  const s = useSharedValue(0.6);
  const o = useSharedValue(0.7);
  useEffect(() => {
    s.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.6, { duration: 0 }),
        withTiming(1.0, { duration: 1800, easing: Easing.out(Easing.quad) }),
      ),
      -1,
    ));
    o.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.7, { duration: 0 }),
        withTiming(0, { duration: 1800, easing: Easing.out(Easing.quad) }),
      ),
      -1,
    ));
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: o.value,
  }));
  return (
    <Animated.View style={[{
      position: 'absolute',
      width: size, height: size,
      borderRadius: size / 2,
      borderWidth: 1.5,
      borderColor: color,
    }, style]} />
  );
}

function EmptyState() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <RNView style={styles.emptyContainer}>
      {/* Radar rings */}
      <RNView style={styles.radarWrap}>
        <ScanRing size={160} delay={0} color="rgba(45,212,191,0.35)" />
        <ScanRing size={110} delay={400} color="rgba(45,212,191,0.45)" />
        <ScanRing size={70} delay={800} color="rgba(45,212,191,0.6)" />
        <RNView style={styles.radarCenter}>
          <Utensils size={26} color="#2DD4BF" />
        </RNView>
      </RNView>

      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 200 }}
        style={{ alignItems: 'center', gap: 8 }}
      >
        <Text style={[styles.emptyTitle, { color: theme.color.val }]}>
          {t('today.noMealsTitle')}
        </Text>
        <Text style={[styles.emptyBody, { color: theme.colorMuted.val }]}>
          {t('today.noMealsBody')}
        </Text>
      </MotiView>
    </RNView>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingState() {
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={{ gap: 16, paddingHorizontal: 16, paddingTop: 8 }}>
      <RNView style={[styles.heroWrapper, { opacity: 0.2, height: 192, marginHorizontal: 0 }]} />
      {[0, 1, 2].map((i) => (
        <RNView key={i} style={[styles.mealCard, {
          backgroundColor: theme.surface.val,
          borderColor: theme.borderColor.val,
        }]}>
          <RNView style={{ gap: 10, padding: 4 }}>
            <ShimmerSkeleton height={15} width="55%" />
            <ShimmerSkeleton height={11} width="30%" />
          </RNView>
        </RNView>
      ))}
    </ScrollView>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function Today() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const { token, uid } = useAuthStore();
  const { data: user } = useQuery<UserOut>({
    queryKey: ['me', uid],
    queryFn: () => api.get('/v1/me'),
    enabled: !!token,
  });
  const { data: meals, isLoading } = useQuery<MealOut[]>({
    queryKey: ['meals', uid],
    queryFn: () => api.get('/v1/meals?limit=10'),
    enabled: !!token,
  });

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (mealId: string) => api.del(`/v1/meals/${mealId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meals', uid] });
    },
  });

  // Extract only the first word from display_name for greeting
  const firstName = user?.display_name?.trim().split(/\s+/)[0];

  const todayMeals = (meals ?? []).filter((m) => {
    const d = new Date(m.eaten_at);
    return d.toDateString() === new Date().toDateString();
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      {/* Top bar */}
      <RNView style={styles.topBar}>
        <LogoLockup size={30} />
        <SettingsButton />
      </RNView>

      {isLoading ? (
        <LoadingState />
      ) : todayMeals.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <HeroCard meals={[]} userName={firstName} />
          <EmptyState />
        </ScrollView>
      ) : (
        <FlatList
          data={todayMeals}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <HeroCard meals={todayMeals} userName={firstName} />
              <RNView style={styles.sectionRow}>
                <Text style={[styles.sectionLabel, { color: theme.color.val }]}>
                  {t('today.todaysMeals')}
                </Text>
                <RNView style={[styles.countBadge, { backgroundColor: 'rgba(45,212,191,0.12)' }]}>
                  <Text style={styles.countText}>{todayMeals.length}</Text>
                </RNView>
              </RNView>
            </>
          }
          renderItem={({ item, index }) => (
            <RNView style={{ paddingHorizontal: 16, marginBottom: 10 }}>
              <MealCard
                meal={item}
                delay={index * 45}
                onPress={() => router.push({ pathname: '/scan/result', params: { mealId: item.id } })}
                onDelete={() => deleteMutation.mutate(item.id)}
              />
            </RNView>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },

  // ── Hero ──
  heroMoti: {
    alignSelf: 'stretch',
    width: '100%',
    flexDirection: 'column',
  },
  heroWrapper: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 22,
    padding: 22,
    paddingBottom: 20,
    overflow: 'hidden',
    minHeight: 192,
    backgroundColor: '#0D2137',
    shadowColor: '#006b5f',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 12,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    left: 0,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  statusPill: {
    backgroundColor: 'rgba(98,244,241,0.12)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(98,244,241,0.25)',
  },
  statusText: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 10,
    color: '#62F4F1',
    letterSpacing: 0.8,
  },
  heroGreeting: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 18,
    color: 'rgba(255,248,234,0.90)',
    marginBottom: 4,
  },
  heroDate: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#FFF8EA',
    letterSpacing: -0.5,
    marginBottom: 22,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  heroStatValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    letterSpacing: -0.5,
  },
  heroStatLabel: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 9,
    color: 'rgba(255,248,234,0.45)',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // ── Meal card ──
  mealCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 12,
  },
  foodIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 5,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mealName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    letterSpacing: -0.1,
    flex: 1,
  },
  mealExtra: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
    color: 'rgba(107,122,118,0.7)',
  },
  timeBadge: {
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  timeText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 11,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  carbPill: {
    borderRadius: 9999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  carbText: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 11,
  },
  kcalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  kcalText: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 11,
  },

  // ── Section header ──
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  countBadge: {
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#2DD4BF',
  },

  // ── Empty state / radar ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 0,
  },
  radarWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  radarCenter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(45,212,191,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(45,212,191,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  emptyBody: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
