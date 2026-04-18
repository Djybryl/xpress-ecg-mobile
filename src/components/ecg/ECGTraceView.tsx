/**
 * ECGTraceView — composant principal d'affichage du tracé ECG mobile.
 * Gère automatiquement le mode image (JPEG/PNG) ou signal (DICOM/SCP/WFDB parsé).
 * Bandeau de mesures, plein écran immersif (toolbar auto-masquée), calibre sur DII.
 *
 * Plein écran : calcule pxPerMm pour que le SVG remplisse exactement la hauteur disponible
 * sans zoom CSS (pas de zone vide). Approche professionnelle standard.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/i18n';
import { ECGImageViewer } from './ECGImageViewer';
import { ECGSignalViewer } from './ECGSignalViewer';
import { ECGToolbar } from './ECGToolbar';
import { ECGMeasurementsStrip } from './ECGMeasurementsStrip';
import { useEcgSignals } from '@/hooks/useEcgSignals';
import type { EcgFileSummary } from '@/hooks/useEcgRecordDetail';
import type { DisplayMode, EcgFilterOptions } from '@/lib/ecg-utils';
import { ROW_HEIGHT_MM } from '@/lib/ecg-utils';
import { extractEcgMeasurements, hasAnyMeasurement } from '@/lib/ecgMeasurementDisplay';

/** Durée avant masquage automatique de la toolbar en plein écran (ms). */
const TOOLBAR_AUTO_HIDE_MS = 3500;

/**
 * Nombre de rangées dans le layout ECG avec bande DII longue.
 * 4×3 : 3 rangées de leads + 1 bande DII = 4 rangées.
 * Utilisé pour calculer pxPerMm en plein écran.
 */
const FS_TOTAL_ROWS = 4;

interface ECGTraceViewProps {
  ecgId: string;
  files?: EcgFileSummary[];
  /** Hauteur maximale du viewer (sans la toolbar) */
  height?: number;
  /** Affichage compact (réduit la toolbar) */
  compact?: boolean;
  /** FC issue du dossier ECG (GET /ecg-records/:id) si disponible */
  recordHeartRate?: number | null;
}

export function ECGTraceView({
  ecgId,
  files,
  height = 280,
  compact,
  recordHeartRate,
}: ECGTraceViewProps & { accessibilityLabel?: string }) {
  const { signals, fileKind, imageUrl, loading, error } = useEcgSignals(ecgId, files);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [speed, setSpeed] = useState<25 | 50>(25);
  const [amplitude, setAmplitude] = useState<5 | 10 | 20>(10);
  const [gridVisible, setGridVisible] = useState(true);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('4x3');
  const [viewMode, setViewMode] = useState<'signal' | 'image'>('signal');
  const [caliper, setCaliper] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const hasSignals = !!signals?.length;
  const hasImage = !!imageUrl;
  const showSignal = hasSignals && viewMode === 'signal';

  const firstSignal = signals?.[0];
  const meta = firstSignal?.metadata as Record<string, unknown> | undefined;
  const isDigitizedImage = !!(
    meta?.digitized_from_image === true ||
    String(firstSignal?.format ?? '').startsWith('digitized_image')
  );

  const filterOpts = useMemo<EcgFilterOptions>(() => ({
    lowPass40: true,
    highPass005: true,
    notch50: false,
    smoothLevel: isDigitizedImage ? 2 : 1,
  }), [isDigitizedImage]);

  const measurements = useMemo(
    () => extractEcgMeasurements(meta, recordHeartRate),
    [meta, recordHeartRate],
  );
  const showMeasurementsStrip = showSignal && hasAnyMeasurement(measurements);

  const disclaimer = useMemo(() => {
    if (!isDigitizedImage) return null;
    if (typeof meta?.disclaimer_fr === 'string' && meta.disclaimer_fr.trim()) {
      return meta.disclaimer_fr.trim();
    }
    return t.ecg.digitizedDisclaimer;
  }, [isDigitizedImage, meta, t]);

  // ── Toolbar plein écran (auto-masquage) ────────────────────────────────

  const [toolbarVisible, setToolbarVisible] = useState(true);
  const toolbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolbarOpacity = useSharedValue(1);
  const toolbarAnimStyle = useAnimatedStyle(() => ({
    opacity: toolbarOpacity.value,
  }));

  const scheduleHideToolbar = useCallback(() => {
    if (toolbarTimer.current) clearTimeout(toolbarTimer.current);
    toolbarTimer.current = setTimeout(() => {
      toolbarOpacity.value = withTiming(0, { duration: 300 });
      setToolbarVisible(false);
    }, TOOLBAR_AUTO_HIDE_MS);
  }, [toolbarOpacity]);

  const showToolbar = useCallback(() => {
    toolbarOpacity.value = withTiming(1, { duration: 180 });
    setToolbarVisible(true);
    scheduleHideToolbar();
  }, [toolbarOpacity, scheduleHideToolbar]);

  const toggleToolbar = useCallback(() => {
    if (toolbarVisible) {
      toolbarOpacity.value = withTiming(0, { duration: 180 });
      setToolbarVisible(false);
      if (toolbarTimer.current) clearTimeout(toolbarTimer.current);
    } else {
      showToolbar();
    }
  }, [toolbarVisible, toolbarOpacity, showToolbar]);

  const openFullscreen = useCallback(() => {
    setFullscreen(true);
    setToolbarVisible(true);
    toolbarOpacity.value = 1;
    scheduleHideToolbar();
  }, [toolbarOpacity, scheduleHideToolbar]);

  const closeFullscreen = useCallback(() => {
    setFullscreen(false);
    if (toolbarTimer.current) clearTimeout(toolbarTimer.current);
  }, []);

  useEffect(() => {
    return () => {
      if (toolbarTimer.current) clearTimeout(toolbarTimer.current);
    };
  }, []);

  // ── Dimensions plein écran ────────────────────────────────────────────

  /** Hauteur réelle mesurée de la zone viewer dans la Modal (onLayout). */
  const [fsLayoutHeight, setFsLayoutHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!fullscreen) setFsLayoutHeight(null);
  }, [fullscreen]);

  /**
   * Hauteur disponible pour le tracé en plein écran.
   * Priorité : mesure onLayout > calcul depuis windowHeight + insets.
   */
  const fsViewerHeight = (() => {
    if (Platform.OS === 'ios') {
      return windowHeight - insets.top - insets.bottom;
    }
    return windowHeight;
  })();
  const fsTraceH = fsLayoutHeight ?? fsViewerHeight;
  const fsTraceW = windowWidth;

  /**
   * pxPerMm calculé pour que le tracé remplisse exactement la hauteur disponible.
   * On suppose 4 rangées (3 leads + DII) pour le layout 4×3 standard.
   * Cela évite toute zone vide et tout zoom CSS de compensation.
   *
   * Formule : pxPerMm = fsTraceH / (FS_TOTAL_ROWS × ROW_HEIGHT_MM)
   * Bornes : min 2 (lisibilité), max 10 (résolution suffisante)
   */
  const fsPxPerMm = useMemo(() => {
    if (!fullscreen || fsTraceH <= 0) return undefined;
    const totalHeightMM = FS_TOTAL_ROWS * ROW_HEIGHT_MM;
    return Math.max(2, Math.min(10, fsTraceH / totalHeightMM));
  }, [fullscreen, fsTraceH]);

  // Réinitialiser le layout 4×3 à l'ouverture du plein écran
  const prevFullscreen = useRef(false);
  useEffect(() => {
    if (fullscreen && !prevFullscreen.current && hasSignals) {
      setDisplayMode('4x3');
    }
    prevFullscreen.current = fullscreen;
  }, [fullscreen, hasSignals]);

  // ── Rendu ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.centered, { height, backgroundColor: colors.screenBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.neutral.textMuted }]}>{t.ecg.loading}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { height: height / 2, backgroundColor: colors.screenBg }]}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.semantic.error} />
        <Text style={[styles.errorText, { color: colors.semantic.error }]}>{error}</Text>
      </View>
    );
  }

  if (!hasSignals && !hasImage) {
    if (fileKind === 'parseable_unparsed') {
      return (
        <View style={[styles.centered, { height: height / 2, backgroundColor: colors.screenBg }]}>
          <Ionicons name="document-outline" size={32} color={colors.semantic.warning} />
          <Text style={[styles.warningText, { color: colors.tipText }]}>
            {t.ecg.parsePending}
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.centered, { height: height / 2, backgroundColor: colors.screenBg }]}>
        <Ionicons name="pulse-outline" size={32} color={colors.neutral.placeholder} />
        <Text style={[styles.emptyText, { color: colors.neutral.textMuted }]}>{t.ecg.emptyTrace}</Text>
      </View>
    );
  }

  const traceBlock = (
    <>
      {showMeasurementsStrip && (
        <ECGMeasurementsStrip measurements={measurements} />
      )}
      {showSignal && firstSignal ? (
        <ECGSignalViewer
          signal={firstSignal}
          displayMode={displayMode}
          gridVisible={gridVisible}
          amplitude={amplitude}
          speed={speed}
          filterOpts={filterOpts}
          height={height}
          caliperEnabled={caliper}
        />
      ) : hasImage ? (
        <ECGImageViewer uri={imageUrl!} height={height} />
      ) : null}
    </>
  );

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: colors.semantic.cardBg,
          borderColor: colors.neutral.border,
        },
      ]}
    >
      {disclaimer && (
        <View
          style={[
            styles.disclaimer,
            {
              backgroundColor: colors.semantic.warningMuted,
              borderBottomColor: colors.semantic.warningBorder,
            },
          ]}
        >
          <Ionicons name="warning-outline" size={14} color={colors.semantic.warning} />
          <Text style={[styles.disclaimerText, { color: colors.tipText }]}>{disclaimer}</Text>
        </View>
      )}

      {traceBlock}

      {!compact && (
        <ECGToolbar
          speed={speed}
          onSpeedChange={setSpeed}
          amplitude={amplitude}
          onAmplitudeChange={setAmplitude}
          gridVisible={gridVisible}
          onGridToggle={() => setGridVisible(v => !v)}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          hasSignals={hasSignals}
          hasImage={hasImage}
          viewMode={viewMode}
          onViewModeToggle={
            hasSignals && hasImage
              ? () => setViewMode(v => (v === 'signal' ? 'image' : 'signal'))
              : undefined
          }
          onFullscreenPress={openFullscreen}
          fullscreenActive={false}
          caliperActive={caliper}
          onCaliperToggle={() => setCaliper(v => !v)}
        />
      )}

      {/* ─── Modal plein écran ──────────────────────────────────────────── */}
      <Modal
        visible={fullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
        onRequestClose={closeFullscreen}
      >
        <StatusBar hidden />
        <View style={styles.fsRoot}>

          {/* Zone tracé — prend tout l'espace */}
          <View
            style={styles.fsViewerWrap}
            onLayout={e => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) setFsLayoutHeight(h);
            }}
          >
            {showSignal && firstSignal ? (
              <ECGSignalViewer
                signal={firstSignal}
                displayMode={displayMode}
                gridVisible={gridVisible}
                amplitude={amplitude}
                speed={speed}
                filterOpts={filterOpts}
                height={fsTraceH}
                caliperEnabled={caliper}
                pxPerMmOverride={fsPxPerMm}
                onSingleTap={toggleToolbar}
              />
            ) : hasImage ? (
              <ECGImageViewer
                uri={imageUrl!}
                height={fsTraceH}
                fullscreen
                onSingleTap={toggleToolbar}
              />
            ) : null}
          </View>

          {/* Bandeau mesures — toujours visible, flottant en haut */}
          {showMeasurementsStrip && (
            <View style={styles.fsMeasurements} pointerEvents="none">
              <ECGMeasurementsStrip measurements={measurements} />
            </View>
          )}

          {/* Bouton fermer — toujours visible en haut à droite */}
          <View
            style={[
              styles.fsCloseBtn,
              { top: Platform.OS === 'ios' ? insets.top + 6 : 10 },
            ]}
          >
            <TouchableOpacity
              onPress={closeFullscreen}
              style={styles.fsIconBtn}
              accessibilityRole="button"
              accessibilityLabel={t.ecg.a11yCloseFullscreen}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Toolbar en bas — auto-masquage avec fondu */}
          <Animated.View
            style={[styles.fsToolbarWrap, toolbarAnimStyle]}
            pointerEvents={toolbarVisible ? 'box-none' : 'none'}
          >
            <View
              style={[
                styles.fsToolbarInner,
                { paddingBottom: Platform.OS === 'ios' ? insets.bottom : 4 },
              ]}
            >
              <ECGToolbar
                speed={speed}
                onSpeedChange={(v) => { setSpeed(v); showToolbar(); }}
                amplitude={amplitude}
                onAmplitudeChange={(v) => { setAmplitude(v); showToolbar(); }}
                gridVisible={gridVisible}
                onGridToggle={() => { setGridVisible(v => !v); showToolbar(); }}
                displayMode={displayMode}
                onDisplayModeChange={(m) => { setDisplayMode(m); showToolbar(); }}
                hasSignals={hasSignals}
                hasImage={hasImage}
                viewMode={viewMode}
                onViewModeToggle={
                  hasSignals && hasImage
                    ? () => { setViewMode(v => (v === 'signal' ? 'image' : 'signal')); showToolbar(); }
                    : undefined
                }
                fullscreenActive
                caliperActive={caliper}
                onCaliperToggle={() => { setCaliper(v => !v); showToolbar(); }}
              />
            </View>
          </Animated.View>

          {/* Hint "Appuyez pour afficher les contrôles" — visible seulement quand toolbar masquée */}
          {!toolbarVisible && (
            <View style={styles.fsHintWrap} pointerEvents="none">
              <Text style={styles.fsHintText}>{t.ecg.tapToShowControls}</Text>
            </View>
          )}

        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
    padding: 16,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 13,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  disclaimerText: {
    fontSize: 10,
    flex: 1,
    lineHeight: 14,
  },

  // ── Plein écran ──────────────────────────────────────────────────────────
  fsRoot: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  fsViewerWrap: {
    flex: 1,
  },
  fsMeasurements: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  fsCloseBtn: {
    position: 'absolute',
    right: 12,
    zIndex: 30,
  },
  fsIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsToolbarWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  fsToolbarInner: {
    backgroundColor: 'rgba(10,10,10,0.85)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 2,
  },
  fsHintWrap: {
    position: 'absolute',
    bottom: 52,
    alignSelf: 'center',
    zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  fsHintText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
});
