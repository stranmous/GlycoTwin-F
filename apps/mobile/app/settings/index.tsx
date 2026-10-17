import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, StyleSheet, View as RNView, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme } from 'tamagui';
import { ChevronRight, Download, Globe, LogOut, Moon, Server, Shield, Trash2, User } from '@tamagui/lucide-icons';
import Constants from 'expo-constants';

import { PressableScale } from '../../src/components/motion/PressableScale';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { api } from '../../src/lib/apiClient';
import { useAuthStore } from '../../src/lib/authStore';
import { useTwinStore } from '../../src/lib/twinStore';
import { AZURE_API_URL, DEFAULT_API_URL } from '../../src/lib/env';
import type { UserOut } from '../../src/types/api';

type RowProps = { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean; isLast?: boolean };

function Row({ icon, label, onPress, danger, isLast }: RowProps) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const isRTL = I18nManager.isRTL || i18n.language === 'ur';
  return (
    <PressableScale onPress={onPress} scale={0.98}>
      <RNView
        style={[
          styles.row,
          {
            borderBottomWidth: isLast ? 0 : 1,
            borderColor: theme.borderColor.val,
          },
        ]}
      >
        <RNView
          style={[
            styles.iconWrap,
            { backgroundColor: danger ? '#FFE5D9' : '#D4F5E9' },
          ]}
        >
          {icon}
        </RNView>
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            fontFamily: 'Nunito_700Bold',
            color: danger ? '#E57373' : theme.color.val,
          }}
        >
          {label}
        </Text>
        {!danger && (
          <ChevronRight
            size={18}
            color={theme.colorMuted.val}
            style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
          />
        )}
      </RNView>
    </PressableScale>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { token, uid, apiUrl, setApiUrl, deleteAccount } = useAuthStore();
  const storeSignOut = useAuthStore((s) => s.signOut);
  const version = Constants.expoConfig?.version ?? '0.1.0';

  const isAzure = apiUrl === AZURE_API_URL;

  const { data: user } = useQuery<UserOut>({
    queryKey: ['me', uid],
    queryFn: () => api.get('/api/v1/auth/profile'),
    enabled: !!token,
  });

  async function handleSignOut() {
    await storeSignOut();
    await useTwinStore.getState().reset();
    qc.clear();
    router.replace('/(auth)/welcome');
  }

  async function toggleServerUrl() {
    const nextUrl = isAzure ? DEFAULT_API_URL : AZURE_API_URL;
    await setApiUrl(nextUrl);
    qc.invalidateQueries();
    const msg = `Switched backend to: ${nextUrl === AZURE_API_URL ? 'Azure Cloud VM' : 'Localhost (port 8000)'}`;
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert('Backend Switch', msg);
    }
  }

  async function handleDeleteAccount() {
    const confirmMessage = 'Are you sure you want to delete your GlycoTwin account? This action is permanent.';
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await deleteAccount();
        await useTwinStore.getState().reset();
        qc.clear();
        router.replace('/(auth)/welcome');
      }
    } else {
      Alert.alert(
        'Delete Account',
        'Are you sure you want to delete your GlycoTwin account? This action is permanent.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Permanently',
            style: 'destructive',
            onPress: async () => {
              await deleteAccount();
              await useTwinStore.getState().reset();
              qc.clear();
              router.replace('/(auth)/welcome');
            },
          },
        ]
      );
    }
  }

  const initial = user?.display_name?.charAt(0)?.toUpperCase() ?? 'U';
  const displayEmail = user?.email
    ? user.email.split('@').length > 2
      ? user.email.replace(/@dev\.local$/, '')
      : user.email
    : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <RNView style={{ flex: 1 }}>
        <ScreenHeader title={t('settings.title')} showBack />

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* User profile card */}
          {user && (
            <RNView
              style={[
                styles.profileCard,
                {
                  backgroundColor: theme.surface.val,
                  borderColor: theme.borderColor.val,
                },
              ]}
            >
              <RNView style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </RNView>
              <RNView style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.userName, { color: theme.color.val }]}>
                  {user.display_name ?? 'GlycoTwin User'}
                </Text>
                <Text style={[styles.userEmail, { color: theme.colorMuted.val }]}>
                  {displayEmail}
                </Text>
              </RNView>
            </RNView>
          )}

          {/* Settings list */}
          <RNView
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.surface.val,
                borderColor: theme.borderColor.val,
              },
            ]}
          >
            <Row
              icon={<User size={18} color="#006A61" />}
              label={t('settings.profile')}
              onPress={() => router.push('/settings/profile')}
            />
            <Row
              icon={<Server size={18} color="#006A61" />}
              label={`Backend Server (${apiUrl.includes('trycloudflare') ? 'Cloudflare Tunnel' : isAzure ? 'Azure VM' : 'Custom/LAN'})`}
              onPress={() => router.push('/settings/server' as any)}
            />
            <Row
              icon={<Globe size={18} color="#006A61" />}
              label={t('settings.language')}
              onPress={() => router.push('/settings/language')}
            />
            <Row
              icon={<Moon size={18} color="#006A61" />}
              label={t('settings.theme')}
              onPress={() => router.push('/settings/theme')}
            />
            <Row
              icon={<Shield size={18} color="#006A61" />}
              label={t('settings.privacy')}
              onPress={() => router.push('/settings/privacy')}
            />
            <Row
              icon={<Download size={18} color="#006A61" />}
              label={t('settings.dataImport')}
              onPress={() => router.push('/settings/data-import')}
              isLast
            />
          </RNView>

          {/* Account Actions Card */}
          <RNView
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.surface.val,
                borderColor: '#FF8A80',
              },
            ]}
          >
            <Row
              icon={<LogOut size={18} color="#991B1B" />}
              label={t('settings.signOut')}
              onPress={handleSignOut}
              danger
            />
            <Row
              icon={<Trash2 size={18} color="#991B1B" />}
              label="Delete Account"
              onPress={handleDeleteAccount}
              danger
              isLast
            />
          </RNView>

          <Text style={[styles.versionText, { color: theme.colorMuted.val }]}>
            {t('settings.appVersion')} {version}
          </Text>
        </ScrollView>
      </RNView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    ...(Platform.OS === 'web' ? { boxShadow: '0 3px 10px rgba(61, 61, 61, 0.05)' } as any : {
      shadowColor: '#3D3D3D',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    }),
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#D4F5E9',
    borderWidth: 1.5,
    borderColor: '#81C995',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 22,
    color: '#006A61',
  },
  userName: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
  },
  userEmail: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 13,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    ...(Platform.OS === 'web' ? { boxShadow: '0 3px 10px rgba(61, 61, 61, 0.05)' } as any : {
      shadowColor: '#3D3D3D',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionText: {
    textAlign: 'center',
    fontFamily: 'Nunito_500Medium',
    fontSize: 13,
    marginTop: 8,
  },
});
