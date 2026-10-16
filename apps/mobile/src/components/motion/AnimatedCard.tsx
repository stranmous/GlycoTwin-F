import { ReactNode } from 'react';
import { Platform, Pressable, View as RNView } from 'react-native';
import { MotiView } from 'moti';
import { useTheme } from 'tamagui';

export function AnimatedCard({
  children,
  delay = 0,
  onPress,
  tone = 'default',
}: {
  children: ReactNode;
  delay?: number;
  onPress?: () => void;
  tone?: 'default' | 'subtle';
}) {
  const theme = useTheme();
  const cardStyle = [
    {
      backgroundColor: theme.surface?.val ?? '#FFFFFF',
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.borderColor?.val ?? 'rgba(61,61,61,0.06)',
    },
    Platform.OS === 'web'
      ? ({
          boxShadow:
            tone === 'subtle'
              ? '0 2px 8px rgba(61, 61, 61, 0.04)'
              : '0 4px 14px rgba(61, 61, 61, 0.06)',
        } as any)
      : {
          shadowColor: '#3D3D3D',
          shadowOffset: { width: 0, height: tone === 'subtle' ? 2 : 4 },
          shadowOpacity: tone === 'subtle' ? 0.04 : 0.06,
          shadowRadius: tone === 'subtle' ? 8 : 14,
          elevation: tone === 'subtle' ? 2 : 3,
        },
  ];

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 160, delay }}
    >
      {onPress ? (
        <Pressable onPress={onPress} style={cardStyle}>
          {children}
        </Pressable>
      ) : (
        <RNView style={cardStyle}>{children}</RNView>
      )}
    </MotiView>
  );
}
