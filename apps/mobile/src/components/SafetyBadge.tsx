import { View as RNView } from 'react-native';
import { Text, useTheme } from 'tamagui';
import { ShieldCheck } from '@tamagui/lucide-icons';

export function SafetyBadge({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <RNView
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: theme.backgroundSecondary?.val ?? '#FFF5EB',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: theme.borderColor?.val ?? 'rgba(61,61,61,0.08)',
        alignSelf: 'flex-start',
      }}
    >
      <ShieldCheck size={14} color="#2AA89A" />
      <Text
        style={{
          fontFamily: 'Nunito_600SemiBold',
          fontSize: 12,
          color: theme.color?.val ?? '#3D3D3D',
        }}
      >
        {label}
      </Text>
    </RNView>
  );
}
