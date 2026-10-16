import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View as RNView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme } from 'tamagui';
import { FileSpreadsheet, UploadCloud } from '@tamagui/lucide-icons';

import { ScreenHeader } from '../../src/components/ScreenHeader';
export default function DataImport() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <RNView style={{ flex: 1 }}>
        <ScreenHeader title={t('settings.dataImport')} showBack />

        <RNView style={{ paddingHorizontal: 16, paddingTop: 16, gap: 16 }}>
          <RNView
            style={[
              styles.card,
              {
                backgroundColor: theme.surface.val,
                borderColor: theme.borderColor.val,
              },
            ]}
          >
            <RNView style={styles.iconCircle}>
              <UploadCloud size={32} color="#006A61" />
            </RNView>

            <Text style={[styles.title, { color: theme.color.val }]}>
              Continuous Glucose & CSV Import
            </Text>

            <Text style={[styles.body, { color: theme.colorMuted.val }]}>
              Seamless import for FreeStyle Libre and Dexcom continuous glucose monitor exports will be enabled via backend cloud integrations in an upcoming update.
            </Text>

            <RNView
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: '#FFF3CD',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 14,
                marginTop: 6,
                borderWidth: 1,
                borderColor: '#FFB347',
              }}
            >
              <FileSpreadsheet size={18} color="#B45309" />
              <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: '#B45309', flex: 1 }}>
                Direct CSV import from health export archives supported soon.
              </Text>
            </RNView>
          </RNView>
        </RNView>
      </RNView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    ...(Platform.OS === 'web' ? { boxShadow: '0 3px 10px rgba(61, 61, 61, 0.05)' } as any : {
      shadowColor: '#3D3D3D',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    }),
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D4F5E9',
    borderWidth: 1.5,
    borderColor: '#81C995',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 18,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
