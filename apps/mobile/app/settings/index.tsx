import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';
import { ChevronRight, Download, Globe, LogOut, Moon, Shield, User } from '@tamagui/lucide-icons';
import Constants from 'expo-constants';

import { PressableScale } from '../../src/components/motion/PressableScale';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useAuthStore } from '../../src/lib/authStore';
import { signOut } from '../../src/lib/firebase';

type RowProps = { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean };
function Row({ icon, label, onPress, danger }: RowProps) {
  return (
    <PressableScale onPress={onPress} scale={0.97}>
      <View
        fd="row"
        ai="center"
        gap="$3"
        py="$4"
        px="$4"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <View
          width={36}
          height={36}
          borderRadius={18}
          bg={danger ? 'rgba(244,63,94,0.10)' : 'rgba(45,212,191,0.10)'}
          ai="center"
          jc="center"
        >
          {icon}
        </View>
        <Text
          f={1}
          fontSize="$5"
          color={danger ? '$danger' : '$color'}
          style={{ fontFamily: 'PlusJakartaSans_600SemiBold' } as any}
        >
          {label}
        </Text>
        {!danger ? <ChevronRight size={18} color="$colorMuted" /> : null}
      </View>
    </PressableScale>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const storeSignOut = useAuthStore((s) => s.signOut);
  const version = Constants.expoConfig?.version ?? '0.1.0';

  async function handleSignOut() {
    await signOut();
    await storeSignOut();
    router.replace('/(auth)/welcome');
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background">
        <ScreenHeader title={t('settings.title')} showBack />
        <ScrollView>
          <View
            bg="$surface"
            mx="$4"
            br="$6"
            mb="$4"
            overflow="hidden"
            borderWidth={1}
            borderColor="$borderColor"
            style={{
              shadowColor: 'rgba(45,212,191,0.06)',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 1,
              shadowRadius: 16,
              elevation: 3,
            } as any}
          >
            <Row icon={<User size={18} color="#2DD4BF" />} label={t('settings.profile')} onPress={() => router.push('/settings/profile')} />
            <Row icon={<Globe size={18} color="#2DD4BF" />} label={t('settings.language')} onPress={() => router.push('/settings/language')} />
            <Row icon={<Moon size={18} color="#2DD4BF" />} label={t('settings.theme')} onPress={() => router.push('/settings/theme')} />
            <Row icon={<Shield size={18} color="#2DD4BF" />} label={t('settings.privacy')} onPress={() => router.push('/settings/privacy')} />
            <Row icon={<Download size={18} color="#2DD4BF" />} label={t('settings.dataImport')} onPress={() => router.push('/settings/data-import')} />
          </View>

          <View
            bg="$surface"
            mx="$4"
            br="$6"
            mb="$4"
            overflow="hidden"
            borderWidth={1}
            borderColor="rgba(244,63,94,0.15)"
          >
            <Row icon={<LogOut size={18} color="#F43F5E" />} label={t('settings.signOut')} onPress={handleSignOut} danger />
          </View>

          <Text ta="center" color="$colorMuted" fontSize="$3" mb="$4">
            {t('settings.appVersion')} {version}
          </Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
