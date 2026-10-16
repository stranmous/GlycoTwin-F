import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TextInput, KeyboardAvoidingView, ScrollView, I18nManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'tamagui';
import { MotiView } from 'moti';
import { ChevronLeft, Eye, EyeOff, ShieldAlert, ShieldCheck } from '@tamagui/lucide-icons';
import Svg, { Path } from 'react-native-svg';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { useAuthStore } from '../../src/lib/authStore';



const FormWrapper = ({ children, onSubmit }: any) => {
  if (Platform.OS === 'web') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {children}
        <button type="submit" style={{ display: 'none' }} />
      </form>
    );
  }
  return <View style={{ gap: 12 }}>{children}</View>;
};

function WarmInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  delay,
  showPasswordToggle,
  onTogglePassword,
  passwordVisible,
  badge,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'email-address' | 'default';
  delay?: number;
  showPasswordToggle?: boolean;
  onTogglePassword?: () => void;
  passwordVisible?: boolean;
  badge?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, delay: delay ?? 0 }}
    >
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.label}>{label}</Text>
          {badge ? <Text style={styles.inputBadge}>{badge}</Text> : null}
        </View>
        <View
          style={[
            styles.inputContainer,
            focused && styles.inputFocused,
          ]}
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#8E8E8E"
            secureTextEntry={secureTextEntry}
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={styles.textInput}
          />
          {showPasswordToggle ? (
            <PressableScale onPress={onTogglePassword} scale={0.9} style={styles.eyeBtn}>
              {passwordVisible ? (
                <EyeOff size={18} color="#8E8E8E" />
              ) : (
                <Eye size={18} color="#8E8E8E" />
              )}
            </PressableScale>
          ) : null}
        </View>
      </View>
    </MotiView>
  );
}

export default function SignUp() {
  const { t, i18n } = useTranslation();
  const isRTL = I18nManager.isRTL || i18n.language === 'ur';
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const setEmailVerified = useAuthStore((s) => s.setEmailVerified);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);



  async function onSubmit() {
    setError(null);
    if (!email || !password || !confirmPassword) return setError(t('auth.errors.required'));
    if (!email.includes('@') || !email.includes('.')) return setError("Please enter a valid email address.");
    if (password.length < 8) return setError(t('auth.errors.weakPassword'));
    if (password !== confirmPassword) return setError("Passwords do not match. Please write the same password.");
    setBusy(true);
    try {
      await useAuthStore.getState().signUp({
        email: email.trim(),
        password,
        active_language: i18n.language === 'ur' ? 'ur' : 'en',
      });
      setEmailVerified(true);
      router.replace('/(onboarding)/consent');
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Sign-up failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FFFBF5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <MotiView
            from={{ opacity: 0, translateX: isRTL ? 12 : -12 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={{ alignSelf: 'flex-start' }}
          >
            <PressableScale
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/welcome'))}
              scale={0.92}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <View style={styles.backBtn}>
                <ChevronLeft
                  size={20}
                  color="#3D3D3D"
                  style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
                />
              </View>
            </PressableScale>
          </MotiView>

          {/* Welcoming Card */}
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: 60 }}
            style={styles.heroCard}
          >
            <View style={styles.badgeRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>✨ Step 1 of 2</Text>
              </View>
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>Free</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>
              {t('auth.signUpTitle', { defaultValue: 'Create account ✨' })}
            </Text>
            <Text style={styles.heroSub}>
              Start your personalized glucose companion journey
            </Text>
          </MotiView>

          {/* Form */}
          <FormWrapper onSubmit={onSubmit}>
            <WarmInput
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              delay={120}
            />
            <WarmInput
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 8 characters"
              secureTextEntry={!showPassword}
              showPasswordToggle
              passwordVisible={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
              badge="8+ chars"
              delay={160}
            />
            <WarmInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              secureTextEntry={!showConfirmPassword}
              showPasswordToggle
              passwordVisible={showConfirmPassword}
              onTogglePassword={() => setShowConfirmPassword((v) => !v)}
              delay={200}
            />

            {/* Privacy Promise Pill */}
            <View style={styles.promiseCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={18} color="#236B40" />
                <Text style={styles.promiseText}>Secure & private health data</Text>
              </View>
              <View style={styles.pill256}>
                <Text style={styles.pill256Text}>256-bit</Text>
              </View>
            </View>

            {error ? (
              <MotiView
                from={{ opacity: 0, translateY: -6 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring' }}
              >
                <View style={styles.errorBox}>
                  <ShieldAlert size={16} color="#BA1A1A" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              </MotiView>
            ) : null}

            <View style={{ marginTop: 16, gap: 12 }}>
              <GlowButton
                label={t('auth.signUp')}
                glow
                size="xl"
                onPress={onSubmit}
                disabled={busy}
              />



              <View style={styles.loginPrompt}>
                <Text style={styles.promptSub}>Already have an account? </Text>
                <PressableScale onPress={() => router.push('/(auth)/login')}>
                  <Text style={styles.promptAction}>Log In</Text>
                </PressableScale>
              </View>
            </View>
          </FormWrapper>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    flexGrow: 1,
  },
  backBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(61,61,61,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  heroCard: {
    backgroundColor: '#FFF5EB',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
    marginBottom: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  stepBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  stepBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#3D3D3D',
  },
  freeBadge: {
    backgroundColor: '#D4F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  freeBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#006A61',
  },
  heroTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: '#3D3D3D',
    marginBottom: 4,
  },
  heroSub: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 13,
    color: '#8E8E8E',
    lineHeight: 18,
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#8E8E8E',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 4,
  },
  inputBadge: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#2AA89A',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(61,61,61,0.1)',
    paddingHorizontal: 16,
    shadowColor: 'rgba(61,61,61,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  inputFocused: {
    borderColor: '#2AA89A',
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontFamily: 'Nunito_500Medium',
    fontSize: 15,
    color: '#3D3D3D',
    borderWidth: 0,
    padding: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  promiseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(166,240,185,0.25)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  promiseText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#236B40',
  },
  pill256: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  pill256Text: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#236B40',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFDAD6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#BA1A1A',
    flex: 1,
  },

  loginPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  promptSub: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 14,
    color: '#8E8E8E',
  },
  promptAction: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#2AA89A',
  },
});
