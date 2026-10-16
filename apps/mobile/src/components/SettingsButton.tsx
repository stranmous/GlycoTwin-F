import { Platform, View as RNView } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings } from '@tamagui/lucide-icons';
import { useTheme } from 'tamagui';
import { PressableScale } from './motion/PressableScale';

export function SettingsButton() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <PressableScale onPress={() => router.push('/settings')} accessibilityLabel="Settings" scale={0.9}>
      <RNView
        style={[
          {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.surface?.val ?? '#FFFFFF',
            borderWidth: 1,
            borderColor: theme.borderColor?.val ?? 'rgba(61,61,61,0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          },
          Platform.OS === 'web'
            ? ({ boxShadow: '0 2px 8px rgba(61, 61, 61, 0.06)' } as any)
            : {
                shadowColor: '#3D3D3D',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
              },
        ]}
      >
        <Settings size={20} color={theme.color?.val ?? '#3D3D3D'} />
      </RNView>
    </PressableScale>
  );
}
