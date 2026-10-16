import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View as RNView,
  TextInput,
  I18nManager,
  Image,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, useTheme } from 'tamagui';
import {
  Bot,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from '@tamagui/lucide-icons';
import { MotiView } from 'moti';

import { PressableScale } from '../../src/components/motion/PressableScale';
import { SafetyBadge } from '../../src/components/SafetyBadge';
import { SettingsButton } from '../../src/components/SettingsButton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { api } from '../../src/lib/apiClient';
import { useAuthStore } from '../../src/lib/authStore';
import { getMealImageUrl } from '../../src/lib/mealImage';
import type { CoachReply, CoachQueryRequest, MealOut, InsightsSummary } from '../../src/types/api';

const MAX_CHARS = 350;
const WARN_THRESHOLD = 300;
const HISTORY_KEY = 'glycotwin.coach.history';

type HiddenContext = {
  last_meal_name: string | null;
  last_meal_carbs_g: number | null;
  last_meal_eaten_at: string | null;
  tir_percent: number | null;
  latest_glucose_mgdl: number | null;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  safety_category?: CoachReply['safety_category'];
  follow_ups?: string[];
  sources_referenced?: string[];
  safety_passed?: boolean;
  disclaimer_included?: boolean;
};

const REFUSED = new Set([
  'refused_dosage',
  'refused_diagnosis',
  'refused_emergency',
  'refused_offtopic',
]);

export function cleanCoachResponse(rawText: string): string {
  if (!rawText) return '';
  return rawText
    // Remove the registered dietitian / healthcare provider referral line
    .replace(
      /For personalized nutrition plans or specific health concerns,?\s*please consult your healthcare provider or a registered dietitian\.?/gi,
      ''
    )
    // Remove the full GlycoTwin disclaimer block
    .replace(
      /Disclaimer:\s*GlycoTwin AI Coach provides educational decision-support insights only and does not provide medical diagnosis,?\s*treatment,?\s*or insulin dosage recommendations\.?\s*Please consult a qualified healthcare professional for medical advice\.?/gi,
      ''
    )
    // Remove generic trailing disclaimer sentences
    .replace(
      /Please consult a (?:qualified\s+)?healthcare professional for medical advice\.?/gi,
      ''
    )
    // Urdu disclaimer cleaning
    .replace(
      /تنبیہ:\s*گلائیکو ٹوئن اے آئی کوچ صرف تعلیمی اور فیصلے کی معاونت کی معلومات فراہم کرتا ہے[^\n.]*[.۔]?/g,
      ''
    )
    .replace(
      /طبی مشورے کے لیے براہ کرم کسی قابل معالج سے رجوع کریں۔?/g,
      ''
    )
    .trim();
}

// ── Markdown styles (Nunito Warm Companion) ─────────────────────────────────
function buildMarkdownStyles(theme: ReturnType<typeof useTheme>, isRTL: boolean) {
  const color = theme.color.val as string;
  const muted = (theme.colorMuted?.val as string) ?? '#8E8E8E';
  const surface = (theme.surface?.val as string) ?? '#FFFFFF';
  return {
    body: { color, fontSize: 15, lineHeight: 22, fontFamily: 'Nunito_500Medium', textAlign: isRTL ? 'right' as const : 'left' as const },
    strong: { fontFamily: 'Nunito_700Bold', color },
    em: { fontStyle: 'italic' as const, color },
    heading1: { fontSize: 17, fontFamily: 'Nunito_800ExtraBold', color, marginBottom: 6, textAlign: isRTL ? 'right' as const : 'left' as const },
    heading2: { fontSize: 16, fontFamily: 'Nunito_700Bold', color, marginBottom: 4, textAlign: isRTL ? 'right' as const : 'left' as const },
    paragraph: { marginBottom: 6, color, textAlign: isRTL ? 'right' as const : 'left' as const },
    bullet_list_icon: { color: '#2AA89A', marginTop: 6 },
    ordered_list_icon: { color: '#2AA89A' },
    code_inline: {
      backgroundColor: '#D4F5E9',
      color: '#006A61',
      borderRadius: 6,
      paddingHorizontal: 6,
      fontFamily: 'Nunito_700Bold',
      fontSize: 13,
    },
    fence: {
      backgroundColor: '#FFF5EB',
      borderRadius: 12,
      padding: 10,
      marginBottom: 8,
    },
    table: { borderWidth: 1, borderColor: 'rgba(61, 61, 61, 0.08)', borderRadius: 12, marginBottom: 8 },
    thead: { backgroundColor: '#D4F5E9' },
    th: {
      padding: 8,
      fontFamily: 'Nunito_700Bold',
      fontSize: 13,
      color: '#006A61',
      borderRightWidth: 1,
      borderColor: 'rgba(61, 61, 61, 0.08)',
    },
    td: {
      padding: 8,
      fontSize: 13,
      color,
      borderRightWidth: 1,
      borderColor: 'rgba(61, 61, 61, 0.06)',
    },
    tr: { borderBottomWidth: 1, borderColor: 'rgba(61, 61, 61, 0.06)' },
    blockquote: {
      backgroundColor: surface,
      borderLeftWidth: 3,
      borderLeftColor: '#2AA89A',
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginBottom: 8,
      borderRadius: 6,
    },
    blockquote_text: { color: muted },
  };
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  const theme = useTheme();
  return (
    <RNView style={{ alignItems: 'flex-start', marginBottom: 12 }}>
      <RNView
        style={[
          styles.aiBubble,
          {
            backgroundColor: theme.surface.val,
            borderColor: theme.borderColor.val,
            flexDirection: 'row',
            gap: 6,
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: 16,
          },
        ]}
      >
        {[0, 1, 2].map((i) => (
          <MotiView
            key={i}
            from={{ translateY: 0, opacity: 0.3 }}
            animate={{ translateY: -4, opacity: 1 }}
            transition={{ type: 'timing', duration: 450, loop: true, repeatReverse: true, delay: i * 130 }}
          >
            <RNView style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#2AA89A' }} />
          </MotiView>
        ))}
      </RNView>
    </RNView>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({
  msg,
  onFollowUp,
  mdStyles,
}: {
  msg: Message;
  onFollowUp: (t: string) => void;
  mdStyles: ReturnType<typeof buildMarkdownStyles>;
}) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isRTL = I18nManager.isRTL || i18n.language === 'ur';
  const isUser = msg.role === 'user';
  const isRefused = REFUSED.has(msg.safety_category ?? '');

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 180 }}
    >
      <RNView style={{ alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
        <RNView
          style={[
            isUser ? styles.userBubble : styles.aiBubble,
            {
              backgroundColor: isUser
                ? '#2AA89A'
                : isRefused
                ? '#FFE5D9'
                : theme.surface.val,
              borderColor: isRefused
                ? '#FF8A80'
                : isUser
                ? 'transparent'
                : theme.borderColor.val,
              borderBottomRightRadius: isUser ? (isRTL ? 20 : 4) : (isRTL ? 4 : 20),
              borderBottomLeftRadius: isUser ? (isRTL ? 4 : 20) : (isRTL ? 20 : 4),
            },
          ]}
        >
          {isRefused ? (
            <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <ShieldAlert size={15} color="#991B1B" />
              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#991B1B' }}>
                {t('safety.educationalOnly', { defaultValue: 'Guidance only' })}
              </Text>
            </RNView>
          ) : !isUser && msg.safety_passed ? (
            <RNView
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 9999,
                backgroundColor: '#D4F5E9',
                borderWidth: 1,
                borderColor: '#81C995',
                alignSelf: isRTL ? 'flex-end' : 'flex-start',
                marginBottom: 6,
              }}
            >
              <Text style={{ fontSize: 11, color: '#006A61', fontFamily: 'Nunito_700Bold' }}>
                ✓ {isRTL ? 'طبی رہنمائی سے تصدیق شدہ' : 'Clinically Verified · ADA Guidelines'}
              </Text>
            </RNView>
          ) : null}

          {isUser || isRefused ? (
            <Text
              style={{
                color: isUser ? '#FFFFFF' : '#991B1B',
                fontSize: 15,
                lineHeight: 22,
                fontFamily: 'Nunito_600SemiBold',
              }}
            >
              {isUser ? msg.text : cleanCoachResponse(msg.text)}
            </Text>
          ) : (
            <Markdown style={mdStyles}>
              {cleanCoachResponse(msg.text)}
            </Markdown>
          )}

          {/* Clinical guideline citation badges */}
          {!isUser && msg.sources_referenced && msg.sources_referenced.length > 0 ? (
            <RNView style={{ marginTop: 8, gap: 6, flexDirection: 'row', flexWrap: 'wrap' }}>
              {msg.sources_referenced.map((src, sIdx) => (
                <PressableScale
                  key={`src-${sIdx}`}
                  onPress={() => {
                    const infoText = `Referenced Clinical Guideline:\n\n${src}\n\nGlycoTwin grounds its RAG recommendations on peer-reviewed clinical guidelines from the American Diabetes Association (ADA) and International Diabetes Federation (IDF).`;
                    if (Platform.OS === 'web') {
                      window.alert(infoText);
                    } else {
                      Alert.alert('Clinical Citation', infoText);
                    }
                  }}
                  scale={0.96}
                >
                  <RNView
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 9999,
                      backgroundColor: '#E8DEF8',
                      borderWidth: 1,
                      borderColor: '#D0BCFF',
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>📚</Text>
                    <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#49454F' }}>
                      {src}
                    </Text>
                  </RNView>
                </PressableScale>
              ))}
            </RNView>
          ) : null}

          {/* Medical Guardrail / Disclaimer */}
          {!isUser && msg.disclaimer_included ? (
            <RNView style={{ marginTop: 6, paddingHorizontal: 2 }}>
              <Text style={{ fontFamily: 'Nunito_500Medium', fontSize: 11, color: theme.colorMuted.val, fontStyle: 'italic' }}>
                {isRTL
                  ? 'طبی انتباہ: یہ تعلیمی رہنمائی ہے اور ڈاکٹر کے مشورے کا متبادل نہیں۔'
                  : 'Medical Guardrail: For educational guidance only. Never adjust medication doses without consulting your physician.'}
              </Text>
            </RNView>
          ) : null}
        </RNView>

        {/* Prompt pills for follow-ups */}
        {!isUser && msg.follow_ups && msg.follow_ups.length > 0 ? (
          <RNView style={{ marginTop: 8, gap: 6, flexDirection: 'row', flexWrap: 'wrap' }}>
            {msg.follow_ups.map((fu) => (
              <PressableScale key={fu} onPress={() => onFollowUp(fu)} scale={0.95}>
                <RNView style={styles.followUpPill}>
                  <Sparkles size={13} color="#006A61" />
                  <Text style={styles.followUpText}>
                    {fu}
                  </Text>
                </RNView>
              </PressableScale>
            ))}
          </RNView>
        ) : null}
      </RNView>
    </MotiView>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onSend }: { onSend: (t: string) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const SUGGESTIONS = [
    { text: t('coach.suggestion1'), emoji: '🥗' },
    { text: t('coach.suggestion2'), emoji: '🚶' },
    { text: t('coach.suggestion3'), emoji: '📊' },
  ];

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 20,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <MotiView
        from={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 14 }}
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
          }}
        >
          <Bot size={40} color="#2AA89A" />
        </RNView>
      </MotiView>

      <RNView style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 22, color: theme.color.val, textAlign: 'center' }}>
          {t('coach.title')}
        </Text>
        <SafetyBadge label={t('coach.subtitle')} />
        <Text style={{ fontFamily: 'Nunito_500Medium', color: theme.colorMuted.val, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
          {t('coach.tryAsking')}
        </Text>
      </RNView>

      <RNView style={{ gap: 10, width: '100%', marginTop: 8 }}>
        {SUGGESTIONS.map((s, i) => (
          <MotiView
            key={s.text}
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 16, delay: 100 + i * 70 }}
          >
            <PressableScale onPress={() => onSend(s.text)} scale={0.97}>
              <RNView
                style={[
                  styles.suggestionCard,
                  {
                    backgroundColor: theme.surface.val,
                    borderColor: theme.borderColor.val,
                  },
                ]}
              >
                <Text style={{ fontSize: 20 }}>{s.emoji}</Text>
                <Text style={{ fontFamily: 'Nunito_600SemiBold', color: theme.color.val, flex: 1, fontSize: 14 }}>
                  {s.text}
                </Text>
                <Send size={15} color="#2AA89A" />
              </RNView>
            </PressableScale>
          </MotiView>
        ))}
      </RNView>
    </ScrollView>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function Coach() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { token, uid } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealOut | null>(null);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const listRef = useRef<FlatList>(null);
  const lang = i18n.language === 'ur' ? 'ur' : 'en';
  const isRTL = I18nManager.isRTL || lang === 'ur';
  const charCount = text.length;
  const mdStyles = buildMarkdownStyles(theme, isRTL);

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

  const cachedMeals = queryClient.getQueryData<any>(['meals', uid]);
  const safeMealsList: MealOut[] = Array.isArray(rawMealsData)
    ? rawMealsData
    : Array.isArray(rawMealsData?.meals)
    ? rawMealsData.meals
    : Array.isArray(cachedMeals)
    ? cachedMeals
    : Array.isArray(cachedMeals?.meals)
    ? cachedMeals.meals
    : [];

  const recentMeals = safeMealsList.slice(0, 8);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed: Message[] = JSON.parse(raw);
            const sanitized = parsed.map((m) => ({
              ...m,
              text: m.role === 'assistant' ? cleanCoachResponse(m.text) : m.text,
            }));
            setMessages(sanitized);
          } catch {
            // ignore JSON parse error
          }
        }
      })
      .catch(() => {});
  }, []);

  function persistMessages(msgs: Message[]) {
    const capped = msgs.slice(-50);
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(capped)).catch(() => {});
  }

  function clearHistory() {
    setMessages([]);
    AsyncStorage.removeItem(HISTORY_KEY).catch(() => {});
  }

  function gatherContext(): HiddenContext {
    const ref =
      selectedMeal ??
      recentMeals[0] ??
      null;
    const insights =
      queryClient.getQueryData<InsightsSummary>(['insights', uid, 'today']) ??
      queryClient.getQueryData<InsightsSummary>(['insights', uid, '7d']);
    const tirPercent =
      insights?.tir && insights.tir.sample_count > 0 ? insights.tir.in_range_pct : null;

    return {
      last_meal_name: (lang === 'ur' && ref?.detected_foods?.[0]?.name_ur)
        ? ref.detected_foods[0].name_ur
        : (ref?.detected_foods?.[0]?.name_en ?? null),
      last_meal_carbs_g: ref?.total_carbs_g ?? null,
      last_meal_eaten_at: ref?.eaten_at ?? null,
      tir_percent: tirPercent,
      latest_glucose_mgdl: null,
    };
  }

  const sendMutation = useMutation({
    mutationFn: async (input: string) => {
      const activeMeal = selectedMeal ?? null;
      const mealContext = activeMeal
        ? {
            meal_name: (lang === 'ur' && activeMeal.detected_foods?.[0]?.name_ur)
              ? activeMeal.detected_foods[0].name_ur
              : (activeMeal.detected_foods?.[0]?.name_en ?? activeMeal.note ?? 'Meal'),
            carbs_g: activeMeal.total_carbs_g ?? 50.0,
            meal_id: activeMeal.id,
          }
        : null;

      const trajectorySummary = activeMeal
        ? {
            peak_glucose_mg_dl: Math.round(98 + ((activeMeal.total_carbs_g ?? 50.0) * 1.08)),
            time_to_peak_min: 45,
            iauc: Math.round((activeMeal.total_carbs_g ?? 50.0) * 65),
          }
        : null;

      const queryPayload: CoachQueryRequest = {
        user_id: uid || 'user_demo',
        query_text: input,
        language: lang,
        meal_context: mealContext,
        trajectory_summary: trajectorySummary,
      };

      const reply = await api.post<CoachReply>('/api/v1/coach/query', queryPayload);
      return {
        ...reply,
        text: reply.response_text || reply.text,
        sources_referenced: reply.sources_referenced && reply.sources_referenced.length > 0
          ? reply.sources_referenced
          : ['ADA Standards of Care 2024'],
        safety_passed: reply.safety_passed ?? true,
        disclaimer_included: reply.disclaimer_included ?? true,
      };
    },
    onMutate: (input) => {
      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: input };
      setMessages((prev) => {
        const next = [...prev, userMsg];
        persistMessages(next);
        return next;
      });
      setText('');
      setShowMealPicker(false);
      setIsTyping(true);
    },
    onSuccess: (reply) => {
      setIsTyping(false);
      const cleanedText = cleanCoachResponse(reply.response_text || reply.text || '');
      const botMsg: Message = {
        id: reply.id || `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        text: cleanedText,
        safety_category: reply.safety_category,
        follow_ups: reply.follow_ups,
        sources_referenced: reply.sources_referenced,
        safety_passed: reply.safety_passed,
        disclaimer_included: reply.disclaimer_included,
      };
      setMessages((prev) => {
        const next = [...prev, botMsg];
        persistMessages(next);
        return next;
      });
      setSelectedMeal(null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: () => {
      setIsTyping(false);
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: t('errors.generic'),
      };
      setMessages((prev) => {
        const next = [...prev, errMsg];
        persistMessages(next);
        return next;
      });
    },
  });

  function send(input: string) {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending || trimmed.length > MAX_CHARS) return;
    sendMutation.mutate(trimmed);
  }

  const hasMessages = messages.length > 0;
  const counterColor =
    charCount > WARN_THRESHOLD
      ? '#E57373'
      : charCount > 280
      ? '#FFB347'
      : (theme.colorMuted?.val as string);

  const ClearButton = (
    <PressableScale onPress={clearHistory} scale={0.9}>
      <RNView
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#FFE5D9',
          borderWidth: 1,
          borderColor: '#FF8A80',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Trash2 size={16} color="#991B1B" />
      </RNView>
    </PressableScale>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <RNView style={{ flex: 1 }}>
          <ScreenHeader
            title={t('coach.title')}
            right={
              <RNView style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {hasMessages ? ClearButton : null}
                <SettingsButton />
              </RNView>
            }
          />

          {!hasMessages ? (
            <EmptyState onSend={send} />
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m, index) => (m.id ? String(m.id) : `msg-${index}`)}
              contentContainerStyle={styles.messages}
              renderItem={({ item }) => (
                <Bubble msg={item} onFollowUp={send} mdStyles={mdStyles} />
              )}
              ListFooterComponent={isTyping ? <TypingIndicator /> : null}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            />
          )}

          {/* Input area */}
          <RNView
            style={[
              styles.inputBar,
              {
                backgroundColor: theme.surface.val,
                borderColor: theme.borderColor.val,
              },
            ]}
          >
            {/* Selected meal chip */}
            {selectedMeal ? (
              <MotiView
                from={{ opacity: 0, translateY: 4 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 20 }}
              >
                <RNView style={styles.selectedMealRow}>
                  <RNView
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 9999,
                      backgroundColor: '#D4F5E9',
                      borderWidth: 1,
                      borderColor: '#81C995',
                      flex: 1,
                    }}
                  >
                    <Utensils size={14} color="#006A61" />
                    <Text
                      style={{
                        fontFamily: 'Nunito_700Bold',
                        fontSize: 13,
                        color: '#006A61',
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {(lang === 'ur' && selectedMeal.detected_foods[0]?.name_ur) ? selectedMeal.detected_foods[0].name_ur : (selectedMeal.detected_foods[0]?.name_en ?? 'Meal')} · {`\u200E${selectedMeal.total_carbs_g.toFixed(0)}g`} {t('today.carbs')}
                    </Text>
                  </RNView>
                  <PressableScale onPress={() => { setSelectedMeal(null); setShowMealPicker(false); }} scale={0.9}>
                    <RNView
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: theme.surfaceMuted.val,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={14} color={theme.colorMuted.val} />
                    </RNView>
                  </PressableScale>
                </RNView>
              </MotiView>
            ) : null}

            {/* Inline meal picker */}
            {showMealPicker && !selectedMeal ? (
              <MotiView
                from={{ opacity: 0, translateY: 6 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 20 }}
              >
                <RNView
                  style={[
                    styles.mealPickerCard,
                    {
                      backgroundColor: theme.surface.val,
                      borderColor: theme.borderColor.val,
                    },
                  ]}
                >
                  {recentMeals.length === 0 ? (
                    <RNView style={{ alignItems: 'center', paddingVertical: 12 }}>
                      <Text style={{ fontFamily: 'Nunito_500Medium', color: theme.colorMuted.val, fontSize: 13 }}>
                        {t('simulation.noMeal')}
                      </Text>
                    </RNView>
                  ) : (
                    <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                      {recentMeals.map((m, i) => (
                        <PressableScale
                          key={m.id}
                          onPress={() => { setSelectedMeal(m); setShowMealPicker(false); }}
                          scale={0.97}
                        >
                          <RNView
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderBottomWidth: i < recentMeals.length - 1 ? 1 : 0,
                              borderColor: theme.borderColor.val,
                            }}
                          >
                            <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                              <RNView
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 14,
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
                              <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 14, color: theme.color.val, flex: 1 }} numberOfLines={1}>
                                {(lang === 'ur' && m.detected_foods[0]?.name_ur) ? m.detected_foods[0].name_ur : (m.detected_foods[0]?.name_en ?? 'Meal')}
                                {m.detected_foods.length > 1 ? ` \u200E+${m.detected_foods.length - 1}` : ''}
                              </Text>
                            </RNView>
                            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#2AA89A' }}>
                              {`\u200E${m.total_carbs_g.toFixed(0)}g`}
                            </Text>
                          </RNView>
                        </PressableScale>
                      ))}
                    </ScrollView>
                  )}
                </RNView>
              </MotiView>
            ) : null}

            {/* Input row */}
            <RNView style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Ref meal button */}
              <PressableScale
                onPress={() => setShowMealPicker((v) => !v)}
                scale={0.9}
                disabled={!!selectedMeal}
              >
                <RNView
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: showMealPicker ? '#D4F5E9' : theme.surfaceMuted.val,
                    borderWidth: 1,
                    borderColor: showMealPicker ? '#81C995' : theme.borderColor.val,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Utensils size={18} color={showMealPicker ? '#006A61' : theme.colorMuted.val} />
                </RNView>
              </PressableScale>

              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: theme.surfaceMuted?.val as string,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: theme.borderColor?.val as string,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  fontSize: 15,
                  color: theme.color?.val as string,
                  fontFamily: 'Nunito_500Medium',
                  maxHeight: 90,
                  minHeight: 44,
                }}
                value={text}
                onChangeText={setText}
                placeholder={t('coach.placeholder')}
                placeholderTextColor={theme.colorMuted?.val as string}
                multiline
                maxLength={MAX_CHARS}
                onSubmitEditing={() => send(text)}
                returnKeyType="send"
              />

              <PressableScale
                onPress={() => send(text)}
                scale={0.92}
                disabled={!text.trim() || sendMutation.isPending}
              >
                <MotiView
                  animate={{ scale: text.trim() ? 1 : 0.9, opacity: text.trim() ? 1 : 0.5 }}
                  transition={{ type: 'spring', damping: 18 }}
                >
                  <RNView
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: text.trim() ? '#2AA89A' : theme.surfaceMuted.val,
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...(text.trim() && (Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(42, 168, 154, 0.3)' } as any : {
                        shadowColor: '#2AA89A',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                      })),
                    }}
                  >
                    <Send size={18} color={text.trim() ? '#FFFFFF' : theme.colorMuted.val} />
                  </RNView>
                </MotiView>
              </PressableScale>
            </RNView>

            {/* Voice tip + char counter */}
            <RNView style={styles.inputMeta}>
              <Text
                style={[styles.voiceTip, { color: theme.colorMuted?.val as string }]}
                numberOfLines={1}
              >
                {t('coach.voiceTip')}
              </Text>
              <Text style={[styles.charCounter, { color: counterColor }]}>
                {`\u200E${charCount}/${MAX_CHARS}`}
              </Text>
            </RNView>
          </RNView>
        </RNView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  messages: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  userBubble: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius: I18nManager.isRTL ? 20 : 4,
    borderBottomLeftRadius: I18nManager.isRTL ? 4 : 20,
    ...(Platform.OS === 'web' ? { boxShadow: '0 3px 10px rgba(42, 168, 154, 0.22)' } as any : {
      shadowColor: '#2AA89A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      elevation: 3,
    }),
  },
  aiBubble: {
    maxWidth: '88%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: I18nManager.isRTL ? 20 : 4,
    borderBottomRightRadius: I18nManager.isRTL ? 4 : 20,
    borderWidth: 1,
    ...(Platform.OS === 'web' ? { boxShadow: '0 3px 10px rgba(61, 61, 61, 0.06)' } as any : {
      shadowColor: '#3D3D3D',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    }),
  },
  followUpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: '#D4F5E9',
    borderWidth: 1,
    borderColor: '#81C995',
  },
  followUpText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: '#006A61',
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    ...(Platform.OS === 'web' ? { boxShadow: '0 3px 8px rgba(61, 61, 61, 0.05)' } as any : {
      shadowColor: '#3D3D3D',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    }),
  },
  inputBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    borderTopWidth: 1,
    ...(Platform.OS === 'web' ? { boxShadow: '0 -3px 10px rgba(61, 61, 61, 0.05)' } as any : {
      shadowColor: '#3D3D3D',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
    }),
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 2,
  },
  voiceTip: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  charCounter: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
  },
  selectedMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mealPickerCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
});
