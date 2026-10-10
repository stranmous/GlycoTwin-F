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
import { signUpEmail, signInWithGoogle } from '../../src/lib/firebase';
import { api } from '../../src/lib/apiClient';
import Svg, { Path } from 'react-native-svg';

function GoogleIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

const FormWrapper = ({ children, onSubmit }: any) => {
  if (Platform.OS === 'web') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}
      >
        {children}
        <button type="submit" style={{ display: 'none' }} />
      </form>
    );
  }
  return <View gap="$4" mt="$3">{children}</View>;
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

export default function SignUp() {
  const { t } = useTranslation();
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const setEmailVerified = useAuthStore((s) => s.setEmailVerified);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      const res = await signInWithGoogle();
      await signIn(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google Sign-In failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    setError(null);
    if (!email || !password || !confirmPassword) return setError(t('auth.errors.required'));
    if (!email.includes('@') || !email.includes('.')) return setError("Please enter a valid email address.");
    if (password.length < 8) return setError(t('auth.errors.weakPassword'));
    if (password !== confirmPassword) return setError("Passwords do not match. Please write the same password.");
    setBusy(true);
    try {
      const res = await signUpEmail(email.trim(), password);
      // Flag email as unverified FIRST so AuthGate doesn't redirect to tabs
      setEmailVerified(false);
      await signIn(res);
      router.replace('/(auth)/verify-email');
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        setError('This email address is already being used. Please go to the sign in screen.');
      } else {
        setError(e instanceof Error ? e.message : 'Sign-up failed');
      }
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
              <View style={styles.backBtn} ai="center" jc="center">
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
            style={{ marginTop: 24, alignItems: 'center' }}
          >
            <Text style={styles.title} color="#FFF8EA">
              {t('auth.signUpTitle', { defaultValue: 'Create an account' })}
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
              placeholder="Min. 8 characters"
              secureTextEntry
              delay={220}
            />
            <GlassInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              secureTextEntry
              delay={260}
            />

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
            ) : null}
          </FormWrapper>

          <View mt="auto" pb="$4" pt="$8" gap="$5">
            <GlowButton
              label={t('auth.signUp')}
              glow
              size="xl"
              onPress={onSubmit}
              disabled={busy}
            />
            <GlowButton
              label="Continue with Google"
              variant="ghost"
              size="xl"
              icon={<GoogleIcon />}
              onPress={handleGoogle}
              disabled={busy}
            />
            <GlowButton
              label={t('auth.haveAccount')}
              variant="ghost"
              size="xl"
              onPress={() => router.replace('/(auth)/login')}
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
