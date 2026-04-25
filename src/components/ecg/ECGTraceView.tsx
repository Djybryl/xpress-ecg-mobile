/**
 * ECGTraceView — composant principal d'affichage du tracé ECG mobile.
 * Gère automatiquement le mode image (JPEG/PNG) ou signal (DICOM/SCP/WFDB parsé).
 * Bandeau de mesures, plein écran immersif (toolbar auto-masquée), calibre sur DII.
 * NOTE BUILD: changement natif expo-screen-orientation -> nécessite un nouveau build EAS.
 *
 * Plein écran : calcule pxPerMm pour que le SVG remplisse exactement la hauteur disponible
 * sans zoom CSS (pas de zone vide). Approche professionnelle standard.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback, useReducer } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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

type ViewerState = {
  speed: 25 | 50;
  amplitude: 5 | 10 | 20;
  gridVisible: boolean;
  displayMode: DisplayMode;
  viewMode: 'signal' | 'image';
  caliper: boolean;
  fullscreen: boolean;
  toolbarVisible: boolean;
};

type ViewerAction =
  | { type: 'SET_SPEED'; value: 25 | 50 }
  | { type: 'SET_AMPLITUDE'; value: 5 | 10 | 20 }
  | { type: 'TOGGLE_GRID' }
  | { type: 'SET_DISPLAY_MODE'; value: DisplayMode }
  | { type: 'TOGGLE_VIEW_MODE' }
  | { type: 'TOGGLE_CALIPER' }
  | { type: 'OPEN_FULLSCREEN' }
  | { type: 'CLOSE_FULLSCREEN' }
  | { type: 'SHOW_TOOLBAR' }
  | { type: 'HIDE_TOOLBAR' };

const initialViewerState: ViewerState = {
  speed: 25,
  amplitude: 10,
  gridVisible: true,
  displayMode: '4x3',
  viewMode: 'signal',
  caliper: false,
  fullscreen: false,
  toolbarVisible: true,
};

function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case 'SET_SPEED':
      return { ...state, speed: action.value };
    case 'SET_AMPLITUDE':
      return { ...state, amplitude: action.value };
    case 'TOGGLE_GRID':
      return { ...state, gridVisible: !state.gridVisible };
    case 'SET_DISPLAY_MODE':
      return { ...state, displayMode: action.value };
    case 'TOGGLE_VIEW_MODE':
      return { ...state, viewMode: state.viewMode === 'signal' ? 'image' : 'signal' };
    case 'TOGGLE_CALIPER':
      return { ...state, caliper: !state.caliper };
    case 'OPEN_FULLSCREEN':
      return { ...state, fullscreen: true, toolbarVisible: true, displayMode: '4x3' };
    case 'CLOSE_FULLSCREEN':
      return { ...state, fullscreen: false };
    case 'SHOW_TOOLBAR':
      return { ...state, toolbarVisible: true };
    case 'HIDE_TOOLBAR':
      return { ...state, toolbarVisible: false };
    default:
      return state;
  }
}

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

  const [state, dispatch] = useReducer(viewerReducer, initialViewerState);

  const hasSignals = !!signals?.length;
  const hasImage = !!imageUrl;
  const showSignal = hasSignals && state.viewMode === 'signal';

  const firstSignal = signals?.[0];
  const meta = firstSignal?.metadata as Record<string, unknown> | undefined;
  const isDigitizedImage = !!(
    meta?.digitized_from_image === true ||
    String(firstSignal?.format ?? '').startsWith('digitized_image')
  );

  const filterOpts = useMemo<EcgFilterOptions>(
    () => ({
      lowPass40: true,
      highPass005: true,
      notch50: false,
      smoothLevel: isDigitizedImage ? 2 : 1,
    }),
    [isDigitizedImage],
  );

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

  const toolbarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolbarOpacity = useSharedValue(1);
  const toolbarAnimStyle = useAnimatedStyle(() => ({
    opacity: toolbarOpacity.value,
  }));

  const scheduleHideToolbar = useCallback(() => {
    if (toolbarTimer.current) clearTimeout(toolbarTimer.current);
    toolbarTimer.current = setTimeout(() => {
      toolbarOpacity.value = withTiming(0, { duration: 300 });
      dispatch({ type: 'HIDE_TOOLBAR' });
    }, TOOLBAR_AUTO_HIDE_MS);
  }, [toolbarOpacity]);

  const showToolbar = useCallback(() => {
    toolbarOpacity.value = withTiming(1, { duration: 180 });
    dispatch({ type: 'SHOW_TOOLBAR' });
    scheduleHideToolbar();
  }, [toolbarOpacity, scheduleHideToolbar]);

  const toggleToolbar = useCallback(() => {
    if (state.toolbarVisible) {
      toolbarOpacity.value = withTiming(0, { duration: 180 });
      dispatch({ type: 'HIDE_TOOLBAR' });
      if (toolbarTimer.current) clearTimeout(toolbarTimer.current);
    } else {
      showToolbar();
    }
  }, [state.toolbarVisible, toolbarOpacity, showToolbar]);

  const openFullscreen = useCallback(async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    dispatch({ type: 'OPEN_FULLSCREEN' });
    toolbarOpacity.value = 1;
    scheduleHideToolbar();
  }, [toolbarOpacity, scheduleHideToolbar]);

  const closeFullscreen = useCallback(async () => {
    await ScreenOrientation.unlockAsync();
    dispatch({ type: 'CLOSE_FULLSCREEN' });
    if (toolbarTimer.current) clearTimeout(toolbarTimer.current);
  }, []);

  useEffect(() => {
    return () => {
      if (toolbarTimer.current) clearTimeout(toolbarTimer.current);
      void ScreenOrientation.unlockAsync();
    };
  }, []);

  // ── Dimensions plein écran ────────────────────────────────────────────

  /** Hauteur réelle mesurée de la zone viewer dans la Modal (onLayout). */
  const [fsLayoutHeight, setFsLayoutHeight] = useState<number | null>(null);
  const prevWindowSize = useRef({ w: windowWidth, h: windowHeight });
  useEffect(() => {
    const prev = prevWindowSize.current;
    if (prev.w !== windowWidth || prev.h !== windowHeight) {
      prevWindowSize.current = { w: windowWidth, h: windowHeight };
      if (state.fullscreen) {
        setFsLayoutHeight(null);
      }
    }
  }, [windowWidth, windowHeight, state.fullscreen]);

  useEffect(() => {
    if (!state.fullscreen) setFsLayoutHeight(null);
  }, [state.fullscreen]);

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
   * ROW_HEIGHT_MM = 30 (confirmé dans ecg-utils.ts)
   * 5 rangées effectives : 4 lignes leads (4×3) + 1 bande DII longue
   * MARGIN_PX = 24 : compense marginTop + paddingTop de la bande DII + marge basse
   */
  const fsPxPerMm = useMemo(() => {
    if (!state.fullscreen || fsTraceH <= 0) return undefined;
    const EFFECTIVE_ROWS = 5;
    const MARGIN_PX = 24;
    const usableH = Math.max(1, fsTraceH - MARGIN_PX);
    return Math.max(2, Math.min(10, usableH / (EFFECTIVE_ROWS * ROW_HEIGHT_MM)));
  }, [state.fullscreen, fsTraceH]);

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
          <Text style={[styles.warningText, { color: colors.tipText }]}>{t.ecg.parsePending}</Text>
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
      {showMeasurementsStrip && <ECGMeasurementsStrip measurements={measurements} />}
      {showSignal && firstSignal ? (
        <ECGSignalViewer
          signal={firstSignal}
          displayMode={state.displayMode}
          gridVisible={state.gridVisible}
          amplitude={state.amplitude}
          speed={state.speed}
          filterOpts={filterOpts}
          height={height}
          caliperEnabled={state.caliper}
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
          speed={state.speed}
          onSpeedChange={v => dispatch({ type: 'SET_SPEED', value: v })}
          amplitude={state.amplitude}
          onAmplitudeChange={v => dispatch({ type: 'SET_AMPLITUDE', value: v })}
          gridVisible={state.gridVisible}
          onGridToggle={() => dispatch({ type: 'TOGGLE_GRID' })}
          displayMode={state.displayMode}
          onDisplayModeChange={m => dispatch({ type: 'SET_DISPLAY_MODE', value: m })}
          hasSignals={hasSignals}
          hasImage={hasImage}
          viewMode={state.viewMode}
          onViewModeToggle={
            hasSignals && hasImage ? () => dispatch({ type: 'TOGGLE_VIEW_MODE' }) : undefined
          }
          onFullscreenPress={openFullscreen}
          fullscreenActive={false}
          caliperActive={state.caliper}
          onCaliperToggle={() => dispatch({ type: 'TOGGLE_CALIPER' })}
        />
      )}

      {state.fullscreen && (
        <Modal
          visible={state.fullscreen}
          animationType="fade"
          presentationStyle="fullScreen"
          supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
          onRequestClose={closeFullscreen}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar hidden />
            <View style={styles.fsRoot}>
              {showMeasurementsStrip && <ECGMeasurementsStrip measurements={measurements} />}

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
                    displayMode={state.displayMode}
                    gridVisible={state.gridVisible}
                    amplitude={state.amplitude}
                    speed={state.speed}
                    filterOpts={filterOpts}
                    height={fsTraceH}
                    caliperEnabled={state.caliper}
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
                  <Ionicons name="close" size={20} color="#1a1a1a" />
                </TouchableOpacity>
              </View>

              <Animated.View
                style={[styles.fsToolbarWrap, toolbarAnimStyle]}
                pointerEvents={state.toolbarVisible ? 'box-none' : 'none'}
              >
                <View
                  style={[
                    styles.fsToolbarInner,
                    { paddingBottom: Platform.OS === 'ios' ? insets.bottom : 4 },
                  ]}
                >
                  <ECGToolbar
                    speed={state.speed}
                    onSpeedChange={v => {
                      dispatch({ type: 'SET_SPEED', value: v });
                      showToolbar();
                    }}
                    amplitude={state.amplitude}
                    onAmplitudeChange={v => {
                      dispatch({ type: 'SET_AMPLITUDE', value: v });
                      showToolbar();
                    }}
                    gridVisible={state.gridVisible}
                    onGridToggle={() => {
                      dispatch({ type: 'TOGGLE_GRID' });
                      showToolbar();
                    }}
                    displayMode={state.displayMode}
                    onDisplayModeChange={m => {
                      dispatch({ type: 'SET_DISPLAY_MODE', value: m });
                      showToolbar();
                    }}
                    hasSignals={hasSignals}
                    hasImage={hasImage}
                    viewMode={state.viewMode}
                    onViewModeToggle={
                      hasSignals && hasImage
                        ? () => {
                            dispatch({ type: 'TOGGLE_VIEW_MODE' });
                            showToolbar();
                          }
                        : undefined
                    }
                    fullscreenActive
                    caliperActive={state.caliper}
                    onCaliperToggle={() => {
                      dispatch({ type: 'TOGGLE_CALIPER' });
                      showToolbar();
                    }}
                  />
                </View>
              </Animated.View>

              {!state.toolbarVisible && (
                <View style={styles.fsHintWrap} pointerEvents="none">
                  <Text style={styles.fsHintText}>{t.ecg.tapToShowControls}</Text>
                </View>
              )}
            </View>
          </GestureHandlerRootView>
        </Modal>
      )}
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
    backgroundColor: '#FFF8F6',
  },
  fsViewerWrap: {
    flex: 1,
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
    backgroundColor: 'rgba(0,0,0,0.12)',
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
    backgroundColor: 'rgba(250,245,240,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.15)',
    paddingTop: 2,
  },
  fsHintWrap: {
    position: 'absolute',
    bottom: 72,
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
