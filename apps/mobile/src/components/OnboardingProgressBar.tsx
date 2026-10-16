import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'tamagui';
import { useTranslation } from 'react-i18next';

export function OnboardingProgressBar({
  step,
  total = 4,
}: {
  step: 1 | 2 | 3 | 4;
  total?: number;
}) {
  const { i18n } = useTranslation();
  const label = i18n.language === 'ur'
    ? `مرحلہ ${step} / ${total}`
    : `Step ${step} of ${total}`;

  return (
    <View style={styles.container}>
      <View style={styles.stepsRow}>
        {[1, 2, 3, 4].map((s) => {
          const isActive = s === step;
          const isCompleted = s < step;
          return (
            <View
              key={s}
              style={[
                styles.stepSegment,
                isActive && styles.stepActive,
                isCompleted && styles.stepCompleted,
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.stepText}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 12,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepSegment: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(61,61,61,0.12)',
  },
  stepActive: {
    width: 36,
    borderRadius: 5,
    backgroundColor: '#2AA89A',
  },
  stepCompleted: {
    backgroundColor: '#81C995',
  },
  stepText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: '#8E8E8E',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
