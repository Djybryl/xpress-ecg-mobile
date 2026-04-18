/**
 * Bandeau compact des mesures automatiques (FC, intervalles) au-dessus du tracé.
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { EcgMeasurementsDisplay } from '@/lib/ecgMeasurementDisplay';
import { useTheme } from '@/providers/ThemeProvider';

interface ECGMeasurementsStripProps {
  measurements: EcgMeasurementsDisplay;
}

function Chip({
  label,
  value,
  borderColor,
  bg,
  labelColor,
  valueColor,
}: {
  label: string;
  value: string;
  borderColor: string;
  bg: string;
  labelColor: string;
  valueColor: string;
}) {
  return (
    <View style={[styles.chip, { borderColor, backgroundColor: bg }]}>
      <Text style={[styles.chipLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.chipValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

export function ECGMeasurementsStrip({ measurements: m }: ECGMeasurementsStripProps) {
  const { colors } = useTheme();
  const raw: { label: string; value: string | null }[] = [
    { label: 'FC', value: m.heartRateBpm != null ? `${Math.round(m.heartRateBpm)} bpm` : null },
    { label: 'PR', value: m.prMs != null ? `${Math.round(m.prMs)} ms` : null },
    { label: 'QRS', value: m.qrsMs != null ? `${Math.round(m.qrsMs)} ms` : null },
    { label: 'QT', value: m.qtMs != null ? `${Math.round(m.qtMs)} ms` : null },
    { label: 'QTc', value: m.qtcMs != null ? `${Math.round(m.qtcMs)} ms` : null },
  ];
  const items = raw.filter((x): x is { label: string; value: string } => x.value != null);

  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[
        styles.row,
        {
          borderBottomColor: colors.neutral.border,
          backgroundColor: colors.neutral.inputBg,
        },
      ]}
      contentContainerStyle={styles.content}
    >
      {items.map(({ label, value }) => (
        <Chip
          key={label}
          label={label}
          value={value}
          borderColor={colors.neutral.border}
          bg={colors.semantic.cardBg}
          labelColor={colors.neutral.textMuted}
          valueColor={colors.neutral.text}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    maxHeight: 36,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 1,
  },
  chipValue: {
    fontSize: 11,
    fontWeight: '700',
  },
});
