import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View as RNView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme } from 'tamagui';
import { CheckCircle2, FileSpreadsheet, UploadCloud, AlertCircle } from '@tamagui/lucide-icons';
import { useQueryClient } from '@tanstack/react-query';

import { ScreenHeader } from '../../src/components/ScreenHeader';
import { GlowButton } from '../../src/components/motion/GlowButton';
import { api } from '../../src/lib/apiClient';
import { useTwinStore } from '../../src/lib/twinStore';

export default function DataImport() {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function ingestReadings(readings: Array<{ timestamp: string; glucose_mg_dl: number }>) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      // 1. Module 1: Ingest CGM time series readings
      const res = await api.post<{ status: string; count: number }>('/api/v1/ingestion/cgm', readings);

      // 2. Module 2: Trigger Digital Twin Calibration on the updated CGM memory
      await useTwinStore.getState().calibrateTwin(undefined, readings).catch(() => {});

      // 3. Invalidate React Query caches for insights and readings
      await queryClient.invalidateQueries({ queryKey: ['readings'] });
      await queryClient.invalidateQueries({ queryKey: ['tir_calc'] });
      await queryClient.invalidateQueries({ queryKey: ['insights'] });
      await queryClient.invalidateQueries({ queryKey: ['insights_summary'] });

      setSuccess(`Successfully ingested ${res.count || readings.length} CGM readings and recalibrated your Digital Twin!`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to ingest CGM readings.');
    } finally {
      setBusy(false);
    }
  }

  function handleLoadSample() {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    const sampleCgm: Array<{ timestamp: string; glucose_mg_dl: number }> = [];
    let g = 96;
    for (let i = 0; i < 12; i++) {
      sampleCgm.push({
        timestamp: new Date(start.getTime() - (12 - i) * 5 * 60000).toISOString(),
        glucose_mg_dl: Math.round(g),
      });
      g += i < 4 ? 3 : -1.5;
    }
    ingestReadings(sampleCgm);
  }

  function handleFileChange(event: any) {
    const file = event.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.trim().split(/\r?\n/).slice(1);
        const parsed = lines
          .map((line) => {
            const parts = line.split(',');
            if (parts.length < 2) return null;
            const ts = parts[0].trim();
            const val = parseFloat(parts[1].trim());
            if (!isFinite(val) || val < 20 || val > 600) return null;
            return {
              timestamp: new Date(ts).toISOString(),
              glucose_mg_dl: Math.round(val * 10) / 10,
            };
          })
          .filter((item): item is { timestamp: string; glucose_mg_dl: number } => item !== null);

        if (parsed.length === 0) {
          setError('No valid CGM rows found in CSV. Expected header: timestamp,glucose_mg_dl');
          return;
        }
        await ingestReadings(parsed);
      } catch {
        setError('Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
  }

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
              Ingest CGM time series readings (Dexcom, FreeStyle Libre, or CSV export) to feed Module 1 Ingestion and calibrate your Module 2 Digital Twin.
            </Text>

            {/* Hidden web file input for CSV uploads */}
            {Platform.OS === 'web' ? (
              <input
                ref={fileInputRef as any}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            ) : null}

            {success ? (
              <RNView style={styles.successBanner}>
                <CheckCircle2 size={18} color="#006A61" />
                <Text style={styles.successText}>{success}</Text>
              </RNView>
            ) : null}

            {error ? (
              <RNView style={styles.errorBanner}>
                <AlertCircle size={18} color="#E57373" />
                <Text style={styles.errorText}>{error}</Text>
              </RNView>
            ) : null}

            <RNView style={{ width: '100%', gap: 10, marginTop: 8 }}>
              {Platform.OS === 'web' ? (
                <GlowButton
                  label="Upload CGM CSV (.csv)"
                  variant="primary"
                  glow
                  disabled={busy}
                  onPress={() => fileInputRef.current?.click()}
                />
              ) : null}

              <GlowButton
                label={busy ? 'Ingesting & Calibrating...' : 'Load Sample Morning CGM Series'}
                variant={Platform.OS === 'web' ? 'secondary' : 'primary'}
                glow={Platform.OS !== 'web'}
                disabled={busy}
                onPress={handleLoadSample}
              />
            </RNView>

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
                CSV format: timestamp,glucose_mg_dl (values 20–600 mg/dL)
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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D4F5E9',
    borderColor: '#81C995',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  successText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: '#006A61',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFE5D9',
    borderColor: '#E57373',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  errorText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: '#D32F2F',
    flex: 1,
  },
});
