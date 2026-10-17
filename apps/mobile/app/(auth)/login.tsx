import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TextInput, KeyboardAvoidingView, ScrollView, I18nManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'tamagui';
import { MotiView } from 'moti';
import { ChevronLeft, Eye, EyeOff, Server, ShieldAlert } from '@tamagui/lucide-icons';
import Svg, { Path } from 'react-native-svg';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { LogoMark } from '../../src/components/Logo';
import { useAuthStore } from '../../src/lib/authStore';
import { useTwinStore } from '../../src/lib/twinStore';



const FormWrapper = ({ children, onSubmit }: any) => {
  if (Platform.OS === 'web') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
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
}) {
  const [focused, setFocused] = useState(false);
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, delay: delay ?? 0 }}
    >
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>{label}</Text>
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

export default function Login() {
  const { t, i18n } = useTranslation();
  const isRTL = I18nManager.isRTL || i18n.language === 'ur';
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const setEmailVerified = useAuthStore((s) => s.setEmailVerified);
  const apiUrl = useAuthStore((s) => s.apiUrl);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function handleForgotPassword() {
    setError(null);
    setResetSent(false);
    if (!email || !email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address to reset password');
      return;
    }
    setBusy(true);
    try {
      // Mock / native reset response for FYP presentation
      setResetSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Password reset failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    setError(null);
    if (!email || !password) {
      setError(t('auth.errors.required', { defaultValue: 'Email and password are required' }));
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setBusy(true);
    try {
      await signIn({ email: email.trim(), password });
      setEmailVerified(true);
      // Auto-trigger Digital Twin calibration upon user login (R2)
      useTwinStore.getState().calibrateTwin().catch(() => {});
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
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
          {/* Top navigation row: Back button & Server selector */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 4 }}>
            <MotiView
              from={{ opacity: 0, translateX: isRTL ? 12 : -12 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'spring', damping: 18 }}
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

            <PressableScale
              onPress={() => router.push('/settings/server' as any)}
              scale={0.94}
            >
              <View style={styles.serverPill}>
                <Server size={13} color="#006A61" />
                <Text style={styles.serverPillText}>
                  {apiUrl.includes('trycloudflare') ? 'Cloudflare Tunnel' : apiUrl.includes('azure') ? 'Azure Cloud' : 'Server Settings'}
                </Text>
              </View>
            </PressableScale>
          </View>

          {/* Friendly Greeting Card */}
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: 60 }}
            style={styles.greetingCard}
          >
            <View style={styles.greetingIconWrapper}>
              <Text style={{ fontSize: 24 }}>👋</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingTitle}>
                {i18n.language === 'ur' ? t('auth.signInTitle') : 'Welcome back, friend!'}
              </Text>
              <Text style={styles.greetingSubtitle}>Your metabolic twin is tuned and ready.</Text>
            </View>
          </MotiView>

          {/* Screen Title */}
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: 100 }}
            style={{ marginBottom: 20 }}
          >
            <Text style={styles.title}>
              {t('auth.signInTitle', { defaultValue: 'Welcome back' })}
            </Text>
            <Text style={styles.subtitle}>
              Log in to view your today's meals & glucose trends.
            </Text>
          </MotiView>

          {/* Input Form */}
          <FormWrapper onSubmit={onSubmit}>
            <WarmInput
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              delay={140}
            />
            <WarmInput
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••••••"
              secureTextEntry={!showPassword}
              showPasswordToggle
              passwordVisible={showPassword}
              onTogglePassword={() => setShowPassword((v) => !v)}
              delay={180}
            />

            <View style={{ alignItems: 'flex-end', marginTop: 4, marginBottom: 8 }}>
              <PressableScale
                onPress={handleForgotPassword}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.forgotPasswordText}>
                  Forgot password?
                </Text>
              </PressableScale>
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
            ) : resetSent ? (
              <MotiView
                from={{ opacity: 0, translateY: -6 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring' }}
              >
                <View style={styles.successBox}>
                  <Text style={styles.successText}>✨ Password reset email sent! Check your inbox.</Text>
                </View>
              </MotiView>
            ) : null}

            <View style={{ marginTop: 16, gap: 12 }}>
              <GlowButton
                label={t('auth.signIn')}
                glow
                size="xl"
                onPress={onSubmit}
                disabled={busy}
              />


              <View style={styles.signupPrompt}>
                <Text style={styles.promptSub}>Don't have an account? </Text>
                <PressableScale onPress={() => router.push('/(auth)/signup')}>
                  <Text style={styles.promptAction}>Sign Up</Text>
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
  greetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF5EB',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(61,61,61,0.06)',
    marginBottom: 20,
  },
  greetingIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF3CD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#006A61',
    marginBottom: 2,
  },
  greetingSubtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#8E8E8E',
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    color: '#3D3D3D',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 14,
    color: '#8E8E8E',
    lineHeight: 20,
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#8E8E8E',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 4,
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
  forgotPasswordText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: '#2AA89A',
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
  successBox: {
    backgroundColor: '#D4F5E9',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  successText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#006A61',
  },

  signupPrompt: {
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
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D4F5E9',
    borderColor: '#81C995',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  serverPillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#006A61',
  },
});
