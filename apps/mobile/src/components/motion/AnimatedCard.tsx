import { ReactNode } from 'react';
import { MotiView } from 'moti';
import { View } from 'tamagui';

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
  const shadow =
    tone === 'subtle'
      ? {
          shadowColor: 'rgba(45,212,191,0.06)',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 10,
          elevation: 2,
        }
      : {
          shadowColor: 'rgba(45,212,191,0.12)',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 1,
          shadowRadius: 20,
          elevation: 4,
        };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, stiffness: 160, delay }}
    >
      <View
        bg="$surface"
        br="$6"
        p="$4"
        borderWidth={1}
        borderColor="$borderColor"
        shadowColor={shadow.shadowColor}
        shadowOffset={shadow.shadowOffset}
        shadowOpacity={shadow.shadowOpacity}
        shadowRadius={shadow.shadowRadius}
        style={{ elevation: shadow.elevation } as any}
        onPress={onPress}
      >
        {children}
      </View>
    </MotiView>
  );
}
