import { useRouter } from 'expo-router';
import { Settings } from '@tamagui/lucide-icons';
import { PressableScale } from './motion/PressableScale';

export function SettingsButton() {
  const router = useRouter();
  return (
    <PressableScale onPress={() => router.push('/settings')} accessibilityLabel="Settings" scale={0.88}>
      <Settings size={22} color="$colorMuted" />
    </PressableScale>
  );
}
