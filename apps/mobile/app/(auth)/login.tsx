import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, TextInput, KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';
import { MotiView } from 'moti';
import { ChevronLeft, ShieldAlert } from '@tamagui/lucide-icons';

import { GlowButton } from '../../src/components/motion/GlowButton';
import { PressableScale } from '../../src/components/motion/PressableScale';
import { LogoMark } from '../../src/components/Logo';
import { useAuthStore } from '../../src/lib/authStore';
import { signInEmail, signInWithGoogle, resetPassword, checkEmailVerified } from '../../src/lib/firebase';
import Svg, { Path } from 'react-native-svg';

const GoogleLogo = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </Svg>
);
import { api } from '../../src/lib/apiClient';

const FormWrapper = ({ children, onSubmit }: any) => {
  if (Platform.OS === 'web') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}
      >
        {children}
        <button type="submit" style={{ display: 'none' }} />
      </form>
    );
  }
  return <View gap="$4" mt="$6">{children}</View>;
};

function GlassInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  delay,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'email-address' | 'default';
  delay?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, delay: delay ?? 0 }}
    >
      <View gap="$1">
        <Text style={styles.label}>{label}</Text>
        <View
          br="$6"
          borderWidth={1.5}
          borderColor={focused ? 'rgba(45,212,191,0.6)' : 'rgba(186,202,197,0.2)'}
          bg="rgba(255,255,255,0.05)"
          style={focused ? styles.inputFocusShadow : undefined}
          overflow="hidden"
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="rgba(186,202,197,0.4)"
            secureTextEntry={secureTextEntry}
            autoCapitalize={autoCapitalize}
            keyboardType={keyboardType}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 16,
              fontSize: 18,
              color: '#FFF8EA',
              fontFamily: 'SpaceGrotesk_400Regular',
              backgroundColor: 'transparent',
              borderWidth: 0,
            }}
          />
        </View>
      </View>
    </MotiView>
  );
}

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const setEmailVerified = useAuthStore((s) => s.setEmailVerified);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      await resetPassword(email.trim());
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
      const res = await signInEmail(email.trim(), password);
      const verified = await checkEmailVerified();
      
      // Update email verified state BEFORE signing in so AuthGate knows whether to route or hold
      setEmailVerified(verified);
      await signIn(res);

      if (!verified) {
        router.replace('/(auth)/verify-email');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }
  async function onGoogleSignIn() {
    setError(null);
    setBusy(true);
    try {
      const res = await signInWithGoogle();
      await signIn(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0E1726' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.safe, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <MotiView
            from={{ opacity: 0, translateX: -12 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={{ alignSelf: 'flex-start' }}
          >
            <PressableScale 
              onPress={() => router.canGoBack() ? router.back() : router.replace('/')} 
              scale={0.92}
              hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
            >
              <View style={styles.backBtn} fd="row" ai="center" gap="$2">
                <ChevronLeft size={18} color="rgba(186,202,197,0.7)" />
              </View>
            </PressableScale>
          </MotiView>

          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: 80 }}
            style={[styles.header, { alignItems: 'center' }]}
          >
            <LogoMark size={100} />
            <Text style={styles.brandName} mt="$3">
              <Text color="#FFF8EA">Glyco</Text>
              <Text color="#2DD4BF">Twin</Text>
            </Text>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: 100 }}
            style={{ marginTop: 24 }}
          >
            <Text style={styles.title} color="#FFF8EA">
              {t('auth.signInTitle', { defaultValue: 'Welcome back' })}
            </Text>
          </MotiView>

          <FormWrapper onSubmit={onSubmit}>
            <GlassInput
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              delay={160}
            />
            <GlassInput
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              delay={220}
            />

            <View ai="flex-end" mt="$-2" mb="$2">
              <PressableScale onPress={handleForgotPassword} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text color="#2DD4BF" fontSize="$3" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
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
                <View fd="row" ai="center" gap="$2">
                  <ShieldAlert size={14} color="#F43F5E" />
                  <Text color="#F43F5E" fontSize="$3">{error}</Text>
                </View>
              </MotiView>
            ) : resetSent ? (
              <MotiView
                from={{ opacity: 0, translateY: -6 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring' }}
              >
                <View fd="row" ai="center" gap="$2">
                  <Text color="#2DD4BF" fontSize="$3">Password reset email sent!</Text>
                </View>
              </MotiView>
            ) : null}
          </FormWrapper>

          <View mt="auto" pb="$4" pt="$8" gap="$3">
            <GlowButton
              label={t('auth.signIn')}
              glow
              size="xl"
              onPress={onSubmit}
              disabled={busy}
            />
            <GlowButton
              label="Login with Google"
              variant="ghost"
              size="xl"
              icon={<GoogleLogo />}
              onPress={onGoogleSignIn}
              disabled={busy}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(186,202,197,0.15)',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginTop: 32,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 32,
    letterSpacing: -0.5,
  },
  brandName: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 40,
    letterSpacing: -1,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: 'rgba(186,202,197,0.7)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputFocusShadow: {
    shadowColor: 'rgba(45,212,191,0.3)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
});
