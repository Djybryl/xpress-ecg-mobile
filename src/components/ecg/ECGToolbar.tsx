/**
 * Barre d'outils ECG mobile — contrôles du viewer (vitesse, amplitude, grille, layout,
 * plein écran, calibre).
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DisplayMode } from '@/lib/ecg-utils';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/i18n';

interface ECGToolbarProps {
  speed: 25 | 50;
  onSpeedChange: (v: 25 | 50) => void;
  amplitude: 5 | 10 | 20;
  onAmplitudeChange: (v: 5 | 10 | 20) => void;
  gridVisible: boolean;
  onGridToggle: () => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (m: DisplayMode) => void;
  hasSignals: boolean;
  hasImage: boolean;
  viewMode?: 'signal' | 'image';
  onViewModeToggle?: () => void;
  /** Ouvre / ferme le mode plein écran (tracé agrandi, rotation autorisée) */
  onFullscreenPress?: () => void;
  /** Si true, le bouton affiche « Réduire » (contexte modal plein écran) */
  fullscreenActive?: boolean;
  /** Mode calibre actif (curseurs sur DII) */
  caliperActive?: boolean;
  onCaliperToggle?: () => void;
}

function ToolButton({
  label,
  icon,
  active,
  onPress,
  disabled,
  colors,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
  colors: { bg: string; bgActive: string; text: string; textActive: string; textDisabled: string };
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: colors.bg },
        active && { backgroundColor: colors.bgActive },
        disabled && styles.buttonDisabled,
      ]}
      activeOpacity={0.7}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={14}
          color={active ? colors.textActive : disabled ? colors.textDisabled : colors.text}
        />
      )}
      <Text
        style={[
          styles.buttonText,
          { color: colors.text },
          active && { color: colors.textActive },
          disabled && { color: colors.textDisabled },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const SPEED_OPTIONS: (25 | 50)[] = [25, 50];
const AMP_OPTIONS: (5 | 10 | 20)[] = [5, 10, 20];
const LAYOUT_OPTIONS: { mode: DisplayMode; label: string }[] = [
  { mode: '4x3', label: '4×3' },
  { mode: '6x2', label: '6×2' },
  { mode: '1x12', label: '12' },
];

export function ECGToolbar({
  speed,
  onSpeedChange,
  amplitude,
  onAmplitudeChange,
  gridVisible,
  onGridToggle,
  displayMode,
  onDisplayModeChange,
  hasSignals,
  hasImage,
  viewMode,
  onViewModeToggle,
  onFullscreenPress,
  fullscreenActive,
  caliperActive,
  onCaliperToggle,
}: ECGToolbarProps) {
  const { colors: joyful } = useTheme();
  const { t } = useTranslation();
  const btn = {
    bg: joyful.neutral.toggleBg,
    bgActive: joyful.primary,
    text: joyful.neutral.textSecondary,
    textActive: '#ffffff',
    textDisabled: joyful.neutral.placeholder,
    sep: joyful.neutral.border,
    groupMuted: joyful.neutral.textMuted,
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      bounces={false}
    >
      {onFullscreenPress && (
        <>
          <ToolButton
            label={fullscreenActive ? t.ecg.reduce : t.ecg.fullscreen}
            icon={fullscreenActive ? 'contract-outline' : 'expand-outline'}
            onPress={onFullscreenPress}
            colors={btn}
          />
          <View style={[styles.separator, { backgroundColor: btn.sep }]} />
        </>
      )}

      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: btn.groupMuted }]}>{t.ecg.mmPerS}</Text>
        <View style={styles.groupButtons}>
          {SPEED_OPTIONS.map(v => (
            <ToolButton
              key={v}
              label={String(v)}
              active={speed === v}
              onPress={() => onSpeedChange(v)}
              disabled={!hasSignals}
              colors={btn}
            />
          ))}
        </View>
      </View>

      <View style={[styles.separator, { backgroundColor: btn.sep }]} />

      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: btn.groupMuted }]}>{t.ecg.mmPerMv}</Text>
        <View style={styles.groupButtons}>
          {AMP_OPTIONS.map(v => (
            <ToolButton
              key={v}
              label={String(v)}
              active={amplitude === v}
              onPress={() => onAmplitudeChange(v)}
              disabled={!hasSignals}
              colors={btn}
            />
          ))}
        </View>
      </View>

      <View style={[styles.separator, { backgroundColor: btn.sep }]} />

      <ToolButton
        label={t.ecg.grid}
        icon="grid-outline"
        active={gridVisible}
        onPress={onGridToggle}
        disabled={!hasSignals}
        colors={btn}
      />

      {onCaliperToggle && (
        <>
          <View style={[styles.separator, { backgroundColor: btn.sep }]} />
          <ToolButton
            label={t.ecg.caliper}
            icon="analytics-outline"
            active={!!caliperActive}
            onPress={onCaliperToggle}
            disabled={!hasSignals}
            colors={btn}
          />
        </>
      )}

      <View style={[styles.separator, { backgroundColor: btn.sep }]} />

      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: btn.groupMuted }]}>{t.ecg.layout}</Text>
        <View style={styles.groupButtons}>
          {LAYOUT_OPTIONS.map(({ mode, label }) => (
            <ToolButton
              key={mode}
              label={label}
              active={displayMode === mode}
              onPress={() => onDisplayModeChange(mode)}
              disabled={!hasSignals}
              colors={btn}
            />
          ))}
        </View>
      </View>

      {hasSignals && hasImage && onViewModeToggle && (
        <>
          <View style={[styles.separator, { backgroundColor: btn.sep }]} />
          <ToolButton
            label={viewMode === 'signal' ? t.ecg.viewImage : t.ecg.viewTrace}
            icon={viewMode === 'signal' ? 'image-outline' : 'pulse-outline'}
            onPress={onViewModeToggle}
            colors={btn}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginRight: 2,
  },
  groupButtons: {
    flexDirection: 'row',
    gap: 2,
  },
  separator: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    minHeight: 28,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
