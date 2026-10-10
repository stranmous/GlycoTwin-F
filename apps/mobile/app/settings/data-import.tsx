import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';
import { ScreenHeader } from '../../src/components/ScreenHeader';

export default function DataImport() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View f={1} bg="$background">
        <ScreenHeader title={t('settings.dataImport')} showBack />
        <View px="$4" pt="$4" gap="$3">
          <Text color="$colorMuted">
            CSV and cloud glucose import (Libre, Dexcom) will be available in a future release via backend-supported import flows.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
