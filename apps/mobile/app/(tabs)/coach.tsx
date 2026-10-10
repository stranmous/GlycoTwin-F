import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View as RNView,
  TextInput,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Text, View, useTheme } from 'tamagui';
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
import type { CoachReply, MealOut } from '../../src/types/api';

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
};

const REFUSED = new Set([
  'refused_dosage',
  'refused_diagnosis',
  'refused_emergency',
  'refused_offtopic',
]);

// ── Markdown styles (theme-aware) ─────────────────────────────────────────────
function buildMarkdownStyles(theme: ReturnType<typeof useTheme>) {
  const color = theme.color.val as string;
  const muted = theme.colorMuted?.val as string ?? '#6B7A76';
  const surface = theme.surface?.val as string ?? '#F3F8F7';
  return {
    body: { color, fontSize: 14, lineHeight: 22, fontFamily: 'SpaceGrotesk_400Regular' },
    strong: { fontFamily: 'PlusJakartaSans_700Bold', color },
    em: { fontStyle: 'italic' as const, color },
    heading1: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color, marginBottom: 6 },
    heading2: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color, marginBottom: 4 },
    paragraph: { marginBottom: 6, color },
    bullet_list_icon: { color: '#2DD4BF', marginTop: 5 },
    ordered_list_icon: { color: '#2DD4BF' },
    code_inline: {
      backgroundColor: 'rgba(45,212,191,0.10)',
      color: '#2DD4BF',
      borderRadius: 4,
      paddingHorizontal: 4,
      fontFamily: 'SpaceGrotesk_500Medium',
      fontSize: 12,
    },
    fence: {
      backgroundColor: 'rgba(45,212,191,0.08)',
      borderRadius: 8,
      padding: 10,
      marginBottom: 8,
    },
    table: { borderWidth: 1, borderColor: 'rgba(45,212,191,0.25)', borderRadius: 8, marginBottom: 8 },
    thead: { backgroundColor: 'rgba(45,212,191,0.10)' },
    th: {
      padding: 8,
      fontFamily: 'PlusJakartaSans_700Bold',
      fontSize: 12,
      color,
      borderRightWidth: 1,
      borderColor: 'rgba(45,212,191,0.2)',
    },
    td: {
      padding: 8,
      fontSize: 12,
      color,
      borderRightWidth: 1,
      borderColor: 'rgba(45,212,191,0.15)',
    },
    tr: { borderBottomWidth: 1, borderColor: 'rgba(45,212,191,0.15)' },
    blockquote: {
      backgroundColor: surface,
      borderLeftWidth: 3,
      borderLeftColor: '#2DD4BF',
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 8,
      borderRadius: 4,
    },
    blockquote_text: { color: muted },
  };
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <View ai="flex-start" mb="$3">
      <View
        px="$4" py="$3" br="$6" bg="$surface"
        borderWidth={1} borderColor="$borderColor"
        fd="row" gap="$2" ai="center"
        style={styles.aiBubbleShadow}
      >
        {[0, 1, 2].map((i) => (
          <MotiView
            key={i}
            from={{ translateY: 0, opacity: 0.4 }}
            animate={{ translateY: -4, opacity: 1 }}
            transition={{ type: 'timing', duration: 500, loop: true, repeatReverse: true, delay: i * 140 }}
          >
            <View width={7} height={7} borderRadius={3.5} bg="$colorMuted" />
          </MotiView>
        ))}
      </View>
    </View>
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
  const isUser = msg.role === 'user';
  const isRefused = REFUSED.has(msg.safety_category ?? '');

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 180 }}
    >
      <View ai={isUser ? 'flex-end' : 'flex-start'} mb="$3">
        <View
          maxWidth="88%" px="$4" py="$3" br="$6"
          bg={isUser ? '$primary' : isRefused ? '$surfaceMuted' : '$surface'}
          borderWidth={isRefused ? 1.5 : isUser ? 0 : 1}
          borderColor={isRefused ? '$danger' : isUser ? undefined : '$borderColor'}
          style={isUser ? styles.userBubbleShadow : styles.aiBubbleShadow}
        >
          {isRefused ? (
            <View fd="row" ai="center" gap="$2" mb="$2">
              <ShieldAlert size={14} color="$danger" />
              <Text fontSize="$3" color="$danger" fontWeight="700">Guidance only</Text>
            </View>
          ) : null}

          {isUser || isRefused ? (
            <Text
              color={isUser ? '$onPrimary' : '$color'}
              fontSize="$4"
              lineHeight={22}
              style={isUser ? { fontFamily: 'SpaceGrotesk_400Regular' } : undefined}
            >
              {msg.text}
            </Text>
          ) : (
            <Markdown style={mdStyles}>
              {msg.text}
            </Markdown>
          )}
        </View>

        {!isUser && msg.follow_ups && msg.follow_ups.length > 0 ? (
          <View mt="$2" gap="$2">
            {msg.follow_ups.map((fu) => (
              <PressableScale key={fu} onPress={() => onFollowUp(fu)} scale={0.94}>
                <View
                  fd="row" ai="center" gap="$2" px="$3" py="$2" br="$8"
                  bg="rgba(59,130,246,0.10)" borderWidth={1.5}
                  borderColor="rgba(59,130,246,0.35)"
                  style={styles.followUpShadow}
                >
                  <Sparkles size={12} color="#3B82F6" />
                  <Text fontSize="$3" color="#3B82F6" fontWeight="700"
                    style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
                    {fu}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </View>
        ) : null}
      </View>
    </MotiView>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onSend }: { onSend: (t: string) => void }) {
  const { t } = useTranslation();
  const SUGGESTIONS = [
    { text: t('coach.suggestion1'), emoji: '🥗' },
    { text: t('coach.suggestion2'), emoji: '🚶' },
    { text: t('coach.suggestion3'), emoji: '📊' },
  ];

  return (
    <View f={1} ai="center" px="$4" pt="$8" gap="$5">
      <MotiView
        from={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12 }}
      >
        <MotiView
          from={{ scale: 1 }}
          animate={{ scale: 1.06 }}
          transition={{ type: 'timing', duration: 1600, loop: true, repeatReverse: true }}
        >
          <View
            width={88} height={88} borderRadius={44}
            bg="rgba(45,212,191,0.12)" ai="center" jc="center"
            borderWidth={2} borderColor="rgba(45,212,191,0.4)"
            style={styles.botShadow}
          >
            <Bot size={40} color="$primary" />
          </View>
        </MotiView>
      </MotiView>

      <View ai="center" gap="$2">
        <Text fontSize="$6" fontWeight="800" ta="center">{t('coach.title')}</Text>
        <SafetyBadge label={t('coach.subtitle')} />
        <Text color="$colorMuted" fontSize="$4" ta="center" mt="$1">{t('coach.tryAsking')}</Text>
      </View>

      <View gap="$2" width="100%">
        {SUGGESTIONS.map((s, i) => (
          <MotiView
            key={s.text}
            from={{ opacity: 0, translateX: -16 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 16, delay: 100 + i * 80 }}
          >
            <PressableScale onPress={() => onSend(s.text)} scale={0.97}>
              <View
                fd="row" ai="center" gap="$3" px="$4" py="$4" br="$6"
                bg="$surface" borderWidth={1} borderColor="$borderColor"
                style={styles.suggestionShadow}
              >
                <Text fontSize="$5">{s.emoji}</Text>
                <Text color="$color" f={1} fontWeight="500">{s.text}</Text>
                <Send size={14} color="$colorMuted" />
              </View>
            </PressableScale>
          </MotiView>
        ))}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function Coach() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { uid } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealOut | null>(null);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const listRef = useRef<FlatList>(null);
  const lang = i18n.language === 'ur' ? 'ur' : 'en';
  const charCount = text.length;
  const mdStyles = buildMarkdownStyles(theme);

  const recentMeals = (
    queryClient.getQueryData<MealOut[]>(['meals', uid]) ?? []
  ).slice(0, 8);

  // Load persisted history on mount
  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY)
      .then((raw) => {
        if (raw) setMessages(JSON.parse(raw));
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
      (queryClient.getQueryData<MealOut[]>(['meals', uid]) ?? [])[0] ??
      null;
    const insights = queryClient.getQueryData<Record<string, number>>(['insights', uid, '7d']);
    return {
      last_meal_name: ref?.detected_foods?.[0]?.name_en ?? null,
      last_meal_carbs_g: ref?.total_carbs_g ?? null,
      last_meal_eaten_at: ref?.eaten_at ?? null,
      tir_percent: insights?.tir_percent ?? null,
      latest_glucose_mgdl: null,
    };
  }

  const sendMutation = useMutation({
    mutationFn: (input: string) =>
      api.post<CoachReply>('/v1/coach/messages', {
        text: input,
        language: lang,
        hidden_context: gatherContext(),
      }),
    onMutate: (input) => {
      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: input };
      setMessages((prev) => {
        const next = [...prev, userMsg];
        persistMessages(next);
        return next;
      });
      setText('');
      setIsTyping(true);
    },
    onSuccess: (reply) => {
      setIsTyping(false);
      const botMsg: Message = {
        id: reply.id,
        role: 'assistant',
        text: reply.text,
        safety_category: reply.safety_category,
        follow_ups: reply.follow_ups,
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
      ? '#F43F5E'
      : charCount > 280
      ? '#FFB24C'
      : (theme.colorMuted?.val as string);

  const ClearButton = (
    <PressableScale onPress={clearHistory} scale={0.9}>
      <View
        width={36} height={36} br="$8"
        bg="rgba(244,63,94,0.08)"
        borderWidth={1} borderColor="rgba(244,63,94,0.2)"
        ai="center" jc="center"
      >
        <Trash2 size={16} color="#F43F5E" />
      </View>
    </PressableScale>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View f={1} bg="$background">
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
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.messages}
              renderItem={({ item }) => (
                <Bubble msg={item} onFollowUp={send} mdStyles={mdStyles} />
              )}
              ListFooterComponent={isTyping ? <TypingIndicator /> : null}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            />
          )}

          {/* Input area */}
          <View
            px="$4" pt="$2" pb="$4"
            bg="$surface"
            borderTopWidth={1}
            borderColor="rgba(45,212,191,0.15)"
            style={styles.inputBarShadow}
          >
            {/* Selected meal chip */}
            {selectedMeal ? (
              <MotiView
                from={{ opacity: 0, translateY: 4 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 20 }}
              >
                <RNView style={styles.selectedMealRow}>
                  <View
                    fd="row" ai="center" gap="$2" px="$3" py="$2" br="$8"
                    bg="rgba(45,212,191,0.12)"
                    borderWidth={1.5} borderColor="rgba(45,212,191,0.4)"
                    f={1}
                  >
                    <Utensils size={13} color="#2DD4BF" />
                    <Text fontSize="$3" color="$primary" fontWeight="700" numberOfLines={1} f={1}>
                      {selectedMeal.detected_foods[0]?.name_en ?? 'Meal'} · {selectedMeal.total_carbs_g.toFixed(0)}g carbs
                    </Text>
                  </View>
                  <PressableScale onPress={() => { setSelectedMeal(null); setShowMealPicker(false); }} scale={0.9}>
                    <View
                      width={28} height={28} br="$8"
                      bg="rgba(107,122,118,0.12)" ai="center" jc="center"
                    >
                      <X size={14} color="$colorMuted" />
                    </View>
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
                <View
                  mb="$2" br="$5" bg="$surface"
                  borderWidth={1} borderColor="rgba(45,212,191,0.2)"
                  style={styles.mealPickerCard}
                >
                  {recentMeals.length === 0 ? (
                    <View ai="center" py="$3">
                      <Text color="$colorMuted" fontSize="$3">No meals logged yet</Text>
                    </View>
                  ) : (
                    <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                      {recentMeals.map((m, i) => (
                        <PressableScale
                          key={m.id}
                          onPress={() => { setSelectedMeal(m); setShowMealPicker(false); }}
                          scale={0.97}
                        >
                          <MotiView
                            from={{ opacity: 0, translateX: -6 }}
                            animate={{ opacity: 1, translateX: 0 }}
                            transition={{ type: 'spring', delay: i * 40 }}
                          >
                            <View
                              fd="row" ai="center" jc="space-between"
                              px="$3" py="$2"
                              borderBottomWidth={i < recentMeals.length - 1 ? 1 : 0}
                              borderColor="rgba(45,212,191,0.12)"
                            >
                              <View fd="row" ai="center" gap="$2">
                                <View
                                  width={8} height={8} borderRadius={4}
                                  bg="$primary" opacity={0.5 + i * 0.06}
                                />
                                <Text fontSize="$3" fontWeight="600">
                                  {m.detected_foods[0]?.name_en ?? 'Meal'}
                                  {m.detected_foods.length > 1 ? ` +${m.detected_foods.length - 1}` : ''}
                                </Text>
                              </View>
                              <Text fontSize="$3" color="$primary" fontWeight="700">
                                {m.total_carbs_g.toFixed(0)}g
                              </Text>
                            </View>
                          </MotiView>
                        </PressableScale>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </MotiView>
            ) : null}

            {/* Input row */}
            <View fd="row" ai="flex-end" gap="$2">
              {/* Ref meal button */}
              <PressableScale
                onPress={() => setShowMealPicker((v) => !v)}
                scale={0.9}
                disabled={!!selectedMeal}
              >
                <View
                  width={44} height={44} br="$8"
                  bg={showMealPicker ? 'rgba(45,212,191,0.15)' : 'rgba(45,212,191,0.08)'}
                  borderWidth={1.5}
                  borderColor={showMealPicker ? 'rgba(45,212,191,0.6)' : 'rgba(45,212,191,0.2)'}
                  ai="center" jc="center"
                >
                  <Utensils size={18} color={showMealPicker ? '#2DD4BF' : '$colorMuted'} />
                </View>
              </PressableScale>

              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: theme.surfaceMuted?.val as string,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.borderColor?.val as string,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 16,
                  color: theme.color?.val as string,
                  fontFamily: 'SpaceGrotesk_400Regular',
                  maxHeight: 100,
                  minHeight: 48,
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
                haptic="medium"
                disabled={!text.trim() || sendMutation.isPending}
              >
                <MotiView
                  animate={{ scale: text.trim() ? 1 : 0.88, opacity: text.trim() ? 1 : 0.5 }}
                  transition={{ type: 'spring', damping: 18 }}
                >
                  <View
                    width={44} height={44} br="$8"
                    bg={text.trim() ? '$primary' : '$surfaceMuted'}
                    ai="center" jc="center"
                    style={text.trim() ? styles.sendShadow : undefined}
                  >
                    <Send size={18} color={text.trim() ? 'white' : '$colorMuted'} />
                  </View>
                </MotiView>
              </PressableScale>
            </View>

            {/* Voice tip + char counter */}
            <RNView style={styles.inputMeta}>
              <Text
                style={[styles.voiceTip, { color: theme.colorMuted?.val as string }]}
                numberOfLines={1}
              >
                {t('coach.voiceTip')}
              </Text>
              <Text style={[styles.charCounter, { color: counterColor }]}>
                {charCount}/{MAX_CHARS}
              </Text>
            </RNView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  messages: {
    padding: 16,
    flexGrow: 1,
  },
  inputBarShadow: {
    shadowColor: 'rgba(45,212,191,0.06)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 10,
  },
  voiceTip: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 11,
    flex: 1,
    marginRight: 8,
  },
  charCounter: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 11,
  },
  botShadow: {
    shadowColor: 'rgba(45,212,191,0.4)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  sendShadow: {
    shadowColor: 'rgba(45,212,191,0.5)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },
  userBubbleShadow: {
    shadowColor: 'rgba(45,212,191,0.25)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  aiBubbleShadow: {
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  followUpShadow: {
    shadowColor: 'rgba(59,130,246,0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  suggestionShadow: {
    shadowColor: 'rgba(45,212,191,0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  selectedMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mealPickerCard: {
    overflow: 'hidden',
    shadowColor: 'rgba(45,212,191,0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
});
