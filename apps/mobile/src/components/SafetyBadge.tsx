import { Text, View } from 'tamagui';
import { ShieldCheck } from '@tamagui/lucide-icons';

export function SafetyBadge({ label }: { label: string }) {
  return (
    <View
      fd="row"
      ai="center"
      gap="$1"
      bg="$primarySoft"
      px="$2"
      py="$1"
      br="$2"
      alignSelf="flex-start"
    >
      <ShieldCheck size={12} color="$primary" />
      <Text fontSize="$2" color="$primary" fontWeight="600">
        {label}
      </Text>
    </View>
  );
}
