import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, Platform, ScrollView, StyleSheet, View as RNView, Image, Pressable, Alert, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, useTheme } from 'tamagui';
import { ChevronRight, Flame, Utensils, Trash2 } from '@tamagui/lucide-icons';
import { MotiView } from 'moti';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
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
import { useTwinStore } from '../../src/lib/twinStore';
import { getMealImageUrl, getDishCulinaryPhoto } from '../../src/lib/mealImage';
import type { MealOut, UserOut, InsightsSummary } from '../../src/types/api';

// ── Pastel rotating palette ─────────────────────────────────────────────────
const PASTEL_PALETTE_LIGHT = ['#FFE5D9', '#D4F5E9', '#FFF3CD', '#E8DEF8'];
const PASTEL_PALETTE_DARK = ['#3D2F28', '#1D352E', '#38321F', '#2E253A'];

// ── Contextual South Asian & General food emoji helper ──────────────────────
function getFoodEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('rice') || lower.includes('biryani') || lower.includes('pulao') || lower.includes('chawal')) return '🍚';
  if (lower.includes('roti') || lower.includes('naan') || lower.includes('paratha') || lower.includes('bread') || lower.includes('chapati')) return '🫓';
  if (lower.includes('chicken') || lower.includes('karahi') || lower.includes('tikka') || lower.includes('kebab') || lower.includes('poultry')) return '🍗';
  if (lower.includes('beef') || lower.includes('mutton') || lower.includes('steak') || lower.includes('lamb') || lower.includes('gosht')) return '🥩';
  if (lower.includes('fish') || lower.includes('salmon') || lower.includes('tuna') || lower.includes('machli') || lower.includes('prawn')) return '🐟';
  if (lower.includes('dal') || lower.includes('daal') || lower.includes('lentil') || lower.includes('soup') || lower.includes('curry') || lower.includes('salan') || lower.includes('haleem') || lower.includes('nihari')) return '🥣';
  if (lower.includes('salad') || lower.includes('cucumber') || lower.includes('kachumber')) return '🥗';
  if (lower.includes('vegetable') || lower.includes('sabzi') || lower.includes('spinach') || lower.includes('palak') || lower.includes('gobi')) return '🥦';
  if (lower.includes('egg') || lower.includes('anda') || lower.includes('omelet')) return '🥚';
  if (lower.includes('mango') || lower.includes('aam')) return '🥭';
  if (lower.includes('banana') || lower.includes('kela')) return '🍌';
  if (lower.includes('apple') || lower.includes('fruit') || lower.includes('chaat')) return '🍎';
  if (lower.includes('tea') || lower.includes('chai') || lower.includes('coffee') || lower.includes('latte')) return '☕';
  return '🍽️';
}

// ── Carb tier & semantic colors ─────────────────────────────────────────────
function carbTier(carbs: number) {
  if (carbs < 30) {
    return {
      accent: '#006A61', // Deep Teal text on Mint
      bg: '#D4F5E9',     // Mint
      label: 'Low',
      stripe: '#81C995',
    };
  }
  if (carbs < 60) {
    return {
      accent: '#B45309', // Warm Deep Amber text on Butter
      bg: '#FFF3CD',     // Butter
      label: 'Mod',
      stripe: '#FFB347',
    };
  }
  return {
    accent: '#991B1B',   // Deep Coral/Rose text on Peach
    bg: '#FFE5D9',       // Peach
    label: 'High',
    stripe: '#FF8A80',
  };
}

// ── Hero card — Warm Companion summary with Donut Ring ──────────────────────
function HeroCard({
  meals,
  userName,
  tirSummary,
}: {
  meals: MealOut[];
  userName?: string;
  tirSummary?: { inRange: number; above: number; below: number };
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.background?.val === '#1C1917' || (theme.background?.val ?? '').includes('28,25');
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

  const inPct = tirSummary ? tirSummary.inRange : (meals.length > 0 ? 84 : 100);
  const abovePct = tirSummary ? tirSummary.above : (meals.length > 0 ? 11 : 0);
  const belowPct = tirSummary ? tirSummary.below : (meals.length > 0 ? 5 : 0);

  const C = 238.76;
  const tot = (inPct + abovePct + belowPct) || 100;
  const inLen = (inPct / tot) * C;
  const aboveLen = (abovePct / tot) * C;
  const belowLen = (belowPct / tot) * C;

  return (
    <RNView style={styles.heroMoti}>
      <MotiView
        from={{ opacity: 0, translateY: -16 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 140, delay: 40 }}
        style={{ flex: 1 }}
      >
        <RNView style={[styles.heroWrapper, {
          backgroundColor: theme.surface.val,
          borderColor: theme.borderColor.val,
          ...(Platform.OS === 'web' ? { boxShadow: '0 8px 24px rgba(61, 61, 61, 0.06)' } as any : {
            shadowColor: '#3D3D3D',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
          }),
        }]}>
          {/* Subtle Warm Peach / Espresso Gradient Background */}
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="heroWarmGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={isDark ? '#3D2F28' : '#FFE5D9'} stopOpacity={isDark ? '0.8' : '0.45'} />
                <Stop offset="0.6" stopColor={isDark ? '#292524' : '#FFF5EB'} stopOpacity={isDark ? '0.9' : '0.75'} />
                <Stop offset="1" stopColor={isDark ? '#1C1917' : '#FFFFFF'} stopOpacity={isDark ? '0.95' : '0.9'} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#heroWarmGrad)" rx="24" />
          </Svg>

          <RNView style={{ position: 'relative', zIndex: 10, flex: 1, justifyContent: 'space-between' }}>
            <RNView style={{ marginBottom: 4 }}>
              <Text style={[styles.heroGreeting, { color: theme.color.val }]}>{greeting}</Text>
              <Text style={[styles.heroDate, { color: theme.colorMuted.val }]}>{dateStr}</Text>
            </RNView>

            {/* Time-in-Range Circular Progress Ring */}
            <RNView style={styles.donutContainer}>
              <RNView style={{ width: 152, height: 152, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <Svg width={152} height={152} viewBox="0 0 100 100">
                  {/* Background Track */}
                  <Circle
                    cx={50}
                    cy={50}
                    r={38}
                    fill="transparent"
                    stroke={isDark ? 'rgba(245, 245, 244, 0.12)' : 'rgba(61, 61, 61, 0.08)'}
                    strokeWidth={10}
                  />
                  {/* Below Range Arc (#E57373) */}
                  {belowLen > 0 && (
                    <Circle
                      cx={50}
                      cy={50}
                      r={38}
                      fill="transparent"
                      stroke="#E57373"
                      strokeWidth={10}
                      strokeDasharray={`${belowLen} 999`}
                      strokeDashoffset={0}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  )}
                  {/* Above Range Arc (#FF8A80) */}
                  {aboveLen > 0 && (
                    <Circle
                      cx={50}
                      cy={50}
                      r={38}
                      fill="transparent"
                      stroke="#FF8A80"
                      strokeWidth={10}
                      strokeDasharray={`${aboveLen} 999`}
                      strokeDashoffset={-belowLen}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  )}
                  {/* In-Range Arc (#81C995) */}
                  {inLen > 0 && (
                    <Circle
                      cx={50}
                      cy={50}
                      r={38}
                      fill="transparent"
                      stroke="#81C995"
                      strokeWidth={10}
                      strokeDasharray={`${inLen} 999`}
                      strokeDashoffset={-(belowLen + aboveLen)}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  )}
                </Svg>
                {/* Center Metrics */}
                <RNView style={styles.donutCenter}>
                  <Text style={[styles.donutValue, { color: theme.color.val }]}>{`\u200E${Math.round(inPct)}%`}</Text>
                  <Text style={[styles.donutLabel, { color: theme.colorMuted.val }]}>{t('insights.tirTitle')}</Text>
                  <RNView style={styles.donutTargetPill}>
                    <Text style={styles.donutTargetText}>{'\u200E70–180 mg/dL'}</Text>
                  </RNView>
                </RNView>
              </RNView>

              {/* Quick Donut Legend Indicator */}
              <RNView style={styles.legendRow}>
                <RNView style={styles.legendItem}>
                  <RNView style={[styles.legendDot, { backgroundColor: '#81C995' }]} />
                  <Text style={[styles.legendText, { color: theme.color.val }]}>{t('insights.inRange')} {`\u200E${Math.round(inPct)}%`}</Text>
                </RNView>
                <RNView style={styles.legendItem}>
                  <RNView style={[styles.legendDot, { backgroundColor: '#FF8A80' }]} />
                  <Text style={[styles.legendText, { color: theme.color.val }]}>{t('insights.above')} {`\u200E${Math.round(abovePct)}%`}</Text>
                </RNView>
                <RNView style={styles.legendItem}>
                  <RNView style={[styles.legendDot, { backgroundColor: '#E57373' }]} />
                  <Text style={[styles.legendText, { color: theme.color.val }]}>{t('insights.below')} {`\u200E${Math.round(belowPct)}%`}</Text>
                </RNView>
              </RNView>
            </RNView>

            {/* Stats row with white pill containers */}
            <RNView style={styles.statsRow}>
              <HeroStat
                value={String(meals.length)}
                label={t('today.meals')}
                icon="🍽️"
                accent="#2AA89A"
              />
              <HeroStat
                value={`\u200E${totalCarbs.toFixed(0)}g`}
                label={t('today.carbs')}
                icon="🌿"
                accent="#FFB347"
              />
              <HeroStat
                value={totalKcal.toFixed(0)}
                label={t('today.kcal')}
                icon="🔥"
                accent="#FF8A80"
              />
            </RNView>
          </RNView>
        </RNView>
      </MotiView>
    </RNView>
  );
}

function HeroStat({ value, label, icon, accent }: { value: string; label: string; icon?: string; accent: string }) {
  const theme = useTheme();
  return (
    <RNView style={[styles.heroStat, {
      backgroundColor: theme.surface.val,
      borderColor: theme.borderColor.val,
      ...(Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(61, 61, 61, 0.04)' } as any : {
        shadowColor: '#3D3D3D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      }),
    }]}>
      {icon ? <Text style={{ fontSize: 16, marginBottom: 2 }}>{icon}</Text> : null}
      <Text style={[styles.heroStatValue, { color: accent }]}>{value}</Text>
      <Text style={[styles.heroStatLabel, { color: theme.colorMuted.val }]}>{label.toUpperCase()}</Text>
    </RNView>
  );
}

// ── Meal card — Warm Companion card with left stripe & rotating pastel ──────
function MealCard({
  meal,
  index = 0,
  delay,
  onPress,
  onDelete,
}: {
  meal: MealOut;
  index?: number;
  delay: number;
  onPress: () => void;
  onDelete?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isRTL = I18nManager.isRTL || i18n.language === 'ur';
  const name = (i18n.language === 'ur' && meal.detected_foods[0]?.name_ur)
    ? meal.detected_foods[0].name_ur
    : (meal.detected_foods[0]?.name_en ?? 'Meal');
  const extra = meal.detected_foods.length > 1 ? ` \u200E+${meal.detected_foods.length - 1}` : '';
  const time = `\u200E${new Date(meal.eaten_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const tier = carbTier(meal.total_carbs_g);
  const [imageError, setImageError] = useState(false);
  const imageUrl = imageError
    ? getDishCulinaryPhoto(meal.detected_foods[0]?.name_en ?? name)
    : getMealImageUrl(meal.image_url, meal.detected_foods[0]?.name_en ?? name);

  const isDark = theme.background?.val === '#1C1917' || (theme.background?.val ?? '').includes('28,25');
  const cardBg = isDark
    ? PASTEL_PALETTE_DARK[index % PASTEL_PALETTE_DARK.length]
    : PASTEL_PALETTE_LIGHT[index % PASTEL_PALETTE_LIGHT.length];

  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 160, delay }}
    >
      <PressableScale onPress={onPress}>
        <RNView
          style={[styles.mealCard, {
            backgroundColor: cardBg,
            borderColor: theme.borderColor.val,
            ...(Platform.OS === 'web' ? { boxShadow: '0 4px 14px rgba(61, 61, 61, 0.06)' } as any : {
              shadowColor: '#3D3D3D',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.06,
              shadowRadius: 14,
            }),
          }]}
        >
          {/* 6px semantic border (left in LTR, right in RTL) */}
          <RNView style={[styles.cardAccent, {
            backgroundColor: tier.stripe,
            left: isRTL ? undefined : 0,
            right: isRTL ? 0 : undefined,
          }]} />

          <RNView style={styles.cardBody}>
            {/* Food photo avatar */}
            <RNView
              style={[
                styles.foodIcon,
                {
                  backgroundColor: tier.bg,
                  overflow: 'hidden',
                  borderWidth: 1.5,
                  borderColor: tier.stripe,
                },
              ]}
            >
              <Image
                source={{ uri: imageUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                onError={() => {
                  if (!imageError) setImageError(true);
                }}
              />
            </RNView>

            {/* Content */}
            <RNView style={styles.cardContent}>
              <RNView style={styles.cardTop}>
                <Text style={[styles.mealName, { color: theme.color.val }]} numberOfLines={1}>
                  {name}
                  {extra ? <Text style={[styles.mealExtra, { color: theme.colorMuted.val }]}>{extra}</Text> : null}
                </Text>
                {/* Time badge */}
                <RNView style={[styles.timeBadge, { backgroundColor: theme.surfaceMuted.val }]}>
                  <Text style={[styles.timeText, { color: theme.colorMuted.val }]}>{time}</Text>
                </RNView>
              </RNView>

              <RNView style={styles.cardMeta}>
                {/* Carb pill */}
                <RNView style={[styles.carbPill, { backgroundColor: tier.bg }]}>
                  <Text style={[styles.carbText, { color: tier.accent }]}>
                    {`\u200E${meal.total_carbs_g.toFixed(0)}g`} {t('today.carbs')}
                  </Text>
                </RNView>
                {/* Kcal */}
                <RNView style={styles.kcalRow}>
                  <Flame size={13} color={theme.colorMuted.val} />
                  <Text style={[styles.kcalText, { color: theme.colorMuted.val }]}>
                    {`\u200E${meal.total_kcal.toFixed(0)} kcal`}
                  </Text>
                </RNView>
              </RNView>
            </RNView>

            <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {onDelete && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    if (Platform.OS === 'web') {
                      if (window.confirm('Delete this meal entry?')) onDelete();
                    } else {
                      Alert.alert(
                        'Delete Meal',
                        'Are you sure you want to delete this meal record?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: onDelete },
                        ]
                      );
                    }
                  }}
                  style={{ padding: 6 }}
                  hitSlop={8}
                >
                  <Trash2 size={18} color="#E57373" opacity={0.85} />
                </Pressable>
              )}
              <ChevronRight
                size={18}
                color={theme.colorMuted.val}
                style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
              />
            </RNView>
          </RNView>
        </RNView>
      </PressableScale>
    </MotiView>
  );
}

// ── Empty state — Warm Mascot / Empathetic notice ───────────────────────────
function EmptyState() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();

  return (
    <RNView style={styles.emptyContainer}>
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 16 }}
        style={styles.emptyIconWrap}
      >
        <RNView style={[styles.emptyIconCircle, { backgroundColor: '#D4F5E9', borderColor: '#81C995' }]}>
          <Utensils size={32} color="#2AA89A" />
        </RNView>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 150 }}
        style={{ alignItems: 'center', gap: 12 }}
      >
        <Text style={[styles.emptyTitle, { color: theme.color.val }]}>
          {t('today.noMealsTitle')}
        </Text>
        <Text style={[styles.emptyBody, { color: theme.colorMuted.val, marginBottom: 8 }]}>
          {t('today.noMealsBody')}
        </Text>
        <PressableScale onPress={() => router.push('/scan/result?mode=manual')}>
          <RNView style={styles.emptyManualBtn}>
            <Text style={styles.emptyManualBtnText}>+ Log meal manually</Text>
          </RNView>
        </PressableScale>
      </MotiView>
    </RNView>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingState() {
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={{ gap: 16, paddingHorizontal: 16, paddingTop: 8 }}>
      <RNView style={[styles.heroWrapper, { opacity: 0.4, height: 260, marginHorizontal: 0, backgroundColor: theme.surfaceMuted.val }]} />
      {[0, 1, 2].map((i) => (
        <RNView key={i} style={[styles.mealCard, {
          backgroundColor: theme.surface.val,
          borderColor: theme.borderColor.val,
          padding: 16,
        }]}>
          <RNView style={{ gap: 10, padding: 4 }}>
            <ShimmerSkeleton height={18} width="55%" />
            <ShimmerSkeleton height={14} width="35%" />
          </RNView>
        </RNView>
      ))}
    </ScrollView>
  );
}

// ── Digital Twin Profile Card (Module M2) ───────────────────────────────────
function DigitalTwinCard({ recentMeals }: { recentMeals?: MealOut[] }) {
  const theme = useTheme();
  const { calibratedState, isCalibrating, calibrateTwin } = useTwinStore();
  const isDark = theme.background?.val === '#1C1917' || (theme.background?.val ?? '').includes('28,25');

  const baseline = calibratedState?.baseline_glucose_mg_dl ?? 98.4;
  const sensitivity = calibratedState?.estimated_insulin_sensitivity ?? 0.041;
  const carbRate = calibratedState?.carb_absorption_rate_index ?? 0.027;
  const confidence = Math.round((calibratedState?.confidence_score ?? 0.82) * 100);
  const isCold = calibratedState?.is_cold_start ?? true;
  const methodLabel = calibratedState?.estimation_method === 'data_fitted' ? 'Data-Calibrated' : 'Demographic Default';

  const handleRecalibrate = () => {
    const mealRecords = (recentMeals ?? []).map((m) => ({ carbs_g: m.total_carbs_g, eaten_at: m.eaten_at }));
    calibrateTwin(undefined, undefined, mealRecords);
  };

  return (
    <RNView style={{ marginHorizontal: 16, marginBottom: 20 }}>
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18, delay: 60 }}
      >
        <RNView
          style={[
            styles.twinCard,
            {
              backgroundColor: theme.surface.val,
              borderColor: theme.borderColor.val,
              ...(Platform.OS === 'web'
                ? ({ boxShadow: '0 4px 16px rgba(42, 168, 154, 0.08)' } as any)
                : {
                    shadowColor: '#2AA89A',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.08,
                    shadowRadius: 12,
                    elevation: 2,
                  }),
            },
          ]}
        >
          {/* Header Row */}
          <RNView style={styles.twinHeader}>
            <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <RNView style={styles.twinIconWrap}>
                <Text style={{ fontSize: 20 }}>🧬</Text>
              </RNView>
              <RNView style={{ flex: 1 }}>
                <Text style={[styles.twinTitle, { color: theme.color.val }]}>Digital Twin Profile</Text>
                <Text style={[styles.twinSub, { color: theme.colorMuted.val }]}>
                  {isCold ? 'Phenotype Cluster: Insulin Resistant' : 'Calibrated Metabolic Twin'}
                </Text>
              </RNView>
            </RNView>

            {/* Method Badge */}
            <RNView
              style={[
                styles.methodBadge,
                { backgroundColor: isCold ? '#FFF3CD' : '#D4F5E9' },
              ]}
            >
              <Text
                style={[
                  styles.methodBadgeText,
                  { color: isCold ? '#B45309' : '#006A61' },
                ]}
              >
                {methodLabel}
              </Text>
            </RNView>
          </RNView>

          {/* 4-Stat Grid */}
          <RNView style={styles.twinGrid}>
            <RNView style={[styles.twinGridCol, { backgroundColor: isDark ? '#1C1917' : '#FFF5EB' }]}>
              <Text style={[styles.twinStatLabel, { color: theme.colorMuted.val }]}>Baseline Glucose</Text>
              <Text style={[styles.twinStatVal, { color: '#2AA89A' }]}>{`\u200E${baseline.toFixed(1)} mg/dL`}</Text>
            </RNView>
            <RNView style={[styles.twinGridCol, { backgroundColor: isDark ? '#1C1917' : '#FFF5EB' }]}>
              <Text style={[styles.twinStatLabel, { color: theme.colorMuted.val }]}>Insulin Sensitivity</Text>
              <Text style={[styles.twinStatVal, { color: '#006A61' }]}>{`\u200E${sensitivity.toFixed(3)}`}</Text>
            </RNView>
            <RNView style={[styles.twinGridCol, { backgroundColor: isDark ? '#1C1917' : '#FFF5EB' }]}>
              <Text style={[styles.twinStatLabel, { color: theme.colorMuted.val }]}>Carb Absorption</Text>
              <Text style={[styles.twinStatVal, { color: '#FFB347' }]}>{`\u200E${carbRate.toFixed(3)}/min`}</Text>
            </RNView>
            <RNView style={[styles.twinGridCol, { backgroundColor: isDark ? '#1C1917' : '#FFF5EB' }]}>
              <Text style={[styles.twinStatLabel, { color: theme.colorMuted.val }]}>Confidence</Text>
              <Text style={[styles.twinStatVal, { color: '#81C995' }]}>{`\u200E${confidence}%`}</Text>
            </RNView>
          </RNView>

          {/* Recalibrate Button */}
          <RNView style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
            <PressableScale
              onPress={handleRecalibrate}
              disabled={isCalibrating}
              scale={0.96}
            >
              <RNView style={styles.recalibrateBtn}>
                <Text style={styles.recalibrateText}>
                  {isCalibrating ? '⚡ Calibrating Twin...' : '🔄 Recalibrate'}
                </Text>
              </RNView>
            </PressableScale>
          </RNView>
        </RNView>
      </MotiView>
    </RNView>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function Today() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.background?.val === '#1C1917' || (theme.background?.val ?? '').includes('28,25');
  const { token, uid } = useAuthStore();
  const { data: user } = useQuery<UserOut | null>({
    queryKey: ['me', uid],
    queryFn: () => api.get<UserOut>('/api/v1/auth/profile').catch(() => null),
    enabled: !!token,
  });
  const { data: rawMeals, isLoading } = useQuery<any>({
    queryKey: ['meals', uid],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/api/v1/ingestion/history/meals');
        if (Array.isArray(res)) return res;
        if (res && Array.isArray(res.meals)) {
          return res.meals.map((m: any, i: number) => ({
            id: m.id || `meal-${i}-${m.logged_at || Date.now()}`,
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
                name_en: m.dish_label || 'Meal',
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

  const { data: insights } = useQuery<InsightsSummary | null>({
    queryKey: ['insights', uid, 'today'],
    queryFn: () => api.get<InsightsSummary>('/api/v1/insights/summary?window=today').catch(() => null),
    enabled: !!token,
  });

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (mealId: string) => api.del(`/api/v1/ingestion/meals/${mealId}`).catch(() => api.del(`/v1/meals/${mealId}`)),
    onMutate: async (mealId: string) => {
      await queryClient.cancelQueries({ queryKey: ['meals'] });
      const previousMeals = queryClient.getQueryData<MealOut[]>(['meals', uid]);
      if (previousMeals) {
        queryClient.setQueryData<MealOut[]>(
          ['meals', uid],
          previousMeals.filter((m) => m.id !== mealId),
        );
      }
      return { previousMeals };
    },
    onError: (_err, _mealId, context) => {
      if (context?.previousMeals) {
        queryClient.setQueryData(['meals', uid], context.previousMeals);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });

  const firstName = user?.display_name?.trim().split(/\s+/)[0];

  const todayMeals = (meals ?? []).filter((m) => {
    const d = new Date(m.eaten_at);
    if (isNaN(d.getTime())) return false;
    const isToday = d.toDateString() === new Date().toDateString();
    const isPast24Hours = Math.abs(Date.now() - d.getTime()) < 24 * 60 * 60 * 1000;
    return isToday || isPast24Hours;
  });

  const displayedMeals = todayMeals.length > 0 ? todayMeals : (meals ?? []);
  const isShowingToday = todayMeals.length > 0;

  const tirSummary = insights && insights.tir && insights.tir.sample_count > 0 ? {
    inRange: insights.tir.in_range_pct,
    above: insights.tir.above_range_pct,
    below: insights.tir.below_range_pct,
  } : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      {/* Top bar */}
      <RNView style={styles.topBar}>
        <LogoLockup size={30} />
        <SettingsButton />
      </RNView>

      {isLoading ? (
        <LoadingState />
      ) : displayedMeals.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <HeroCard meals={[]} userName={firstName} tirSummary={tirSummary} />
          <DigitalTwinCard recentMeals={meals ?? []} />
          <EmptyState />
        </ScrollView>
      ) : (
        <FlatList
          data={displayedMeals}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <HeroCard meals={displayedMeals} userName={firstName} tirSummary={tirSummary} />
              <DigitalTwinCard recentMeals={meals ?? []} />
              <RNView style={styles.sectionRow}>
                <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.sectionLabel, { color: theme.color.val }]}>
                    {isShowingToday ? t('today.todaysMeals') : (i18n.language === 'ur' ? 'حالیہ کھانے' : 'Recent Meals')}
                  </Text>
                  <RNView style={styles.countBadge}>
                    <Text style={styles.countText}>{displayedMeals.length}</Text>
                  </RNView>
                </RNView>
                <PressableScale onPress={() => router.push('/scan/result?mode=manual')}>
                  <RNView style={[styles.manualLogPill, { backgroundColor: isDark ? '#004D40' : '#E6F4F1', borderColor: isDark ? '#80CBC4' : '#2AA89A' }]}>
                    <Text style={[styles.manualLogPillText, { color: isDark ? '#E0F2F1' : '#006A61' }]}>
                      + Log manually
                    </Text>
                  </RNView>
                </PressableScale>
              </RNView>
            </>
          }
          renderItem={({ item, index }) => (
            <RNView style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <MealCard
                meal={item}
                index={index}
                delay={index * 45}
                onPress={() => router.push({ pathname: '/meal/[id]', params: { id: item.id } })}
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
  },
  heroWrapper: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 240,
  },
  heroGreeting: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 2,
  },
  heroDate: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    marginBottom: 6,
  },
  donutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  donutCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  donutValue: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 26,
    letterSpacing: -0.5,
  },
  donutLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: '#8E8E8E',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  donutTargetPill: {
    backgroundColor: '#D4F5E9',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 3,
  },
  donutTargetText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: '#006A61',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  heroStat: {
    flex: 1,
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  heroStatValue: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
    marginBottom: 1,
  },
  heroStatLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // ── Meal card ──
  mealCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 88,
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 6,
    zIndex: 2,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 18,
    gap: 12,
  },
  foodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mealName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    flex: 1,
  },
  mealExtra: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 13,
  },
  timeBadge: {
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timeText: {
    fontFamily: 'Nunito_600SemiBold',
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
    paddingVertical: 3,
  },
  carbText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
  },
  kcalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  kcalText: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 12,
  },

  // ── Section header ──
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
  },
  countBadge: {
    borderRadius: 9999,
    backgroundColor: '#D4F5E9',
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  countText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 12,
    color: '#006A61',
  },
  manualLogPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  manualLogPillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
  },
  emptyManualBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: '#2AA89A',
  },
  emptyManualBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },

  // ── Empty state ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 60,
  },
  emptyIconWrap: {
    marginBottom: 20,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyBody: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Digital Twin Card Styles ──
  twinCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  twinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  twinIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D4F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  twinTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 16,
  },
  twinSub: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 12,
  },
  methodBadge: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  methodBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
  },
  twinGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  twinGridCol: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 10,
    gap: 2,
  },
  twinStatLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  twinStatVal: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 15,
  },
  recalibrateBtn: {
    borderRadius: 9999,
    backgroundColor: '#D4F5E9',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#81C995',
  },
  recalibrateText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#006A61',
  },
});
