/**
 * Rendu natif des signaux ECG parsés via react-native-svg.
 * Grille millimétrique calibrée (petits 1 mm + grands 5 mm), layouts 4×3 / 6×2 / 1×12,
 * impulsion de calibration 1 mV, filtres Biquad, Bézier lissé,
 * pan + pinch-to-zoom + double-tap reset, calibre optionnel sur la bande DII.
 *
 * En plein écran, pxPerMmOverride est calculé par ECGTraceView pour que le tracé
 * remplisse exactement la hauteur disponible (pas de transform-scale, pas de zone vide).
 */
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  type EcgSignalData,
  type DisplayMode,
  type EcgFilterOptions,
  buildPathCache,
  enrichSignalWithDerivedLeads,
  getNumCols,
  getNumRows,
  LEAD_ORDER_4X3,
  LEAD_ORDER_6X2,
  LEAD_ORDER_12,
  PX_PER_MM_MOBILE,
  ROW_HEIGHT_MM,
} from '@/lib/ecg-utils';
import { useTheme } from '@/providers/ThemeProvider';
import { ECGCaliperStrip } from '@/components/ecg/ECGCaliperStrip';

interface ECGSignalViewerProps {
  signal: EcgSignalData;
  displayMode?: DisplayMode;
  gridVisible?: boolean;
  amplitude?: number;
  speed?: number;
  filterOpts?: EcgFilterOptions;
  height?: number;
  /** Affiche l'impulsion carrée 1 mV en début de chaque dérivation */
  showCalibrationPulse?: boolean;
  /** Mode calibre : curseurs sur DII, pan du tracé désactivé */
  caliperEnabled?: boolean;
  /** Résolution forcée (px/mm) — utilisée en plein écran pour remplir la hauteur sans zoom CSS */
  pxPerMmOverride?: number;
  /** Rappel quand l'utilisateur tape sur le tracé (toggle toolbar en plein écran) */
  onSingleTap?: () => void;
}

type EcgColors = {
  gridMinor: string;
  gridMajor: string;
  trace: string;
  calib: string;
  label: string;
  bg: string;
};

const LABEL_W = 28;

/** Impulsion 1 mV (carré) au début de la zone de tracé */
function calibration1mVPath(cellHeight: number, pxPerMm: number, amplitudeMmPerMv: number): string {
  const cy = cellHeight / 2;
  const ampPx = pxPerMm * amplitudeMmPerMv;
  const w = 2 * pxPerMm;
  const x0 = pxPerMm;
  return `M ${x0},${cy} L ${x0},${cy - ampPx} L ${x0 + w},${cy - ampPx} L ${x0 + w},${cy}`;
}

function buildGridPaths(width: number, height: number, pxPerMm: number): { minorGridD: string; majorGridD: string } {
  const small = pxPerMm;
  const large = 5 * pxPerMm;
  let minorD = '';
  let majorD = '';
  for (let x = 0; x <= width; x += small) {
    if (Math.abs(x % large) < 0.1) majorD += `M${x},0V${height}`;
    else minorD += `M${x},0V${height}`;
  }
  for (let y = 0; y <= height; y += small) {
    if (Math.abs(y % large) < 0.1) majorD += `M0,${y}H${width}`;
    else minorD += `M0,${y}H${width}`;
  }
  return { minorGridD: minorD, majorGridD: majorD };
}

const CalibratedGrid = React.memo(function CalibratedGrid({
  minorD,
  majorD,
  width,
  height,
  c,
}: {
  minorD: string;
  majorD: string;
  width: number;
  height: number;
  c: EcgColors;
}) {
  return (
    <G>
      {minorD ? <Path d={minorD} stroke={c.gridMinor} strokeWidth={0.4} fill="none" /> : null}
      {majorD ? <Path d={majorD} stroke={c.gridMajor} strokeWidth={0.8} fill="none" /> : null}
    </G>
  );
});

const LeadCell = React.memo(function LeadCell({
  lead,
  pathD,
  cellWidth,
  cellHeight,
  gridVisible,
  minorGridD,
  majorGridD,
  amplitude,
  showCalibrationPulse,
  pxPerMm,
  c,
}: {
  lead: string;
  pathD: string | undefined;
  cellWidth: number;
  cellHeight: number;
  gridVisible: boolean;
  minorGridD: string;
  majorGridD: string;
  amplitude: number;
  showCalibrationPulse: boolean;
  pxPerMm: number;
  c: EcgColors;
}) {
  const calibD = showCalibrationPulse ? calibration1mVPath(cellHeight, pxPerMm, amplitude) : '';
  return (
    <View style={styles.leadCell}>
      <Text style={[styles.leadLabel, { color: c.label }]}>{lead}</Text>
      <Svg width={cellWidth} height={cellHeight}>
        {gridVisible && (
          <CalibratedGrid
            minorD={minorGridD}
            majorD={majorGridD}
            width={cellWidth}
            height={cellHeight}
            c={c}
          />
        )}
        {calibD ? (
          <Path
            d={calibD}
            fill="none"
            stroke={c.calib}
            strokeWidth={1.2}
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        ) : null}
        {pathD ? (
          <Path
            d={pathD}
            fill="none"
            stroke={c.trace}
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <Path
            d={`M0,${cellHeight / 2}H${cellWidth}`}
            fill="none"
            stroke={c.gridMinor}
            strokeWidth={0.5}
            strokeDasharray="4,2"
          />
        )}
      </Svg>
    </View>
  );
});

export function ECGSignalViewer({
  signal,
  displayMode = '4x3',
  gridVisible = true,
  amplitude = 10,
  speed = 25,
  filterOpts = { lowPass40: true, highPass005: true },
  height: containerHeightProp,
  showCalibrationPulse = true,
  caliperEnabled = false,
  pxPerMmOverride,
  onSingleTap,
}: ECGSignalViewerProps) {
  const { isDark, colors: joyful } = useTheme();
  const c: EcgColors = useMemo(
    () => ({
      gridMinor: joyful.semantic.ecgGrid,
      gridMajor: isDark ? '#5a3a4a' : '#e0a0a0',
      trace: joyful.semantic.ecgTrace,
      calib: joyful.neutral.textSecondary,
      label: joyful.semantic.ecgLabel,
      bg: joyful.semantic.cardBg,
    }),
    [isDark, joyful],
  );
  const { width: screenWidth } = useWindowDimensions();

  /** pxPerMm : résolution de base ou résolution imposée par le parent (plein écran). */
  const pxPerMm = pxPerMmOverride ?? PX_PER_MM_MOBILE;
  const numCols = getNumCols(displayMode);
  const numRows = getNumRows(displayMode);

  const duration = Math.max(signal.duration_seconds, 0.1);
  const totalTraceWidth = speed * duration * pxPerMm;
  const cellWidth = totalTraceWidth / numCols;
  const cellHeight = ROW_HEIGHT_MM * pxPerMm;
  const contentWidth = totalTraceWidth + LABEL_W * numCols;

  const { minorGridD: leadMinorGridD, majorGridD: leadMajorGridD } = useMemo(
    () => buildGridPaths(cellWidth, cellHeight, pxPerMm),
    [pxPerMm, cellWidth, cellHeight],
  );
  const { minorGridD: wideMinorGridD, majorGridD: wideMajorGridD } = useMemo(
    () => buildGridPaths(totalTraceWidth, cellHeight, pxPerMm),
    [pxPerMm, totalTraceWidth, cellHeight],
  );

  const [pathCache, setPathCache] = useState<Record<string, string>>({});
  const [pathsReady, setPathsReady] = useState(false);
  const filterKey = `${filterOpts.lowPass40}_${filterOpts.highPass005}_${filterOpts.notch50 ?? false}_${filterOpts.smoothLevel ?? 0}`;
  const sigFingerprint = `${signal.format}_${signal.sample_rate}_${signal.duration_seconds}_${signal.leads.join(',')}_${String(signal.samples.II?.length ?? signal.samples.I?.length ?? 0)}`;
  const buildKey = `${sigFingerprint}_${displayMode}_${amplitude}_${speed}_${pxPerMm}_${cellWidth.toFixed(4)}_${cellHeight.toFixed(4)}_${filterKey}`;

  useEffect(() => {
    setPathsReady(false);
    const tid = setTimeout(() => {
      const cache = buildPathCache(signal, displayMode, amplitude, cellWidth, cellHeight, filterOpts, pxPerMm);
      setPathCache(cache);
      setPathsReady(true);
    }, 0);
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildKey regroupe les entrées du cache
  }, [buildKey]);

  const enrichedHasII = !!enrichSignalWithDerivedLeads(signal).samples.II?.length;
  const caliperExtra = caliperEnabled && enrichedHasII ? 26 : 0;
  const contentHeight =
    numRows * cellHeight + (enrichedHasII ? cellHeight + 8 + caliperExtra : 0) + 8;

  /**
   * Dimensions du viewport.
   * - vw : largeur disponible (plein écran = toute la largeur de l'écran)
   * - vh : hauteur passée par le parent (doit correspondre à la hauteur réelle du conteneur)
   * En plein écran avec pxPerMmOverride, contentHeight ≈ vh → plus de zone vide.
   */
  const isFullscreen = pxPerMmOverride != null;
  const vw = isFullscreen ? screenWidth : screenWidth - 16;
  const vh =
    containerHeightProp != null
      ? containerHeightProp
      : Math.min(contentHeight + 16, 400);
  const cw = contentWidth;
  const ch = contentHeight;

  // ── Gestes (pinch + pan + double-tap + single-tap) ──────────────────────

  const scaleVal = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      scaleVal.value = Math.max(0.5, Math.min(5, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scaleVal.value < 1) {
        scaleVal.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTX.value = 0;
        savedTY.value = 0;
      } else {
        savedScale.value = scaleVal.value;
      }
    });

  const pan = Gesture.Pan()
    .enabled(!caliperEnabled)
    .minDistance(4)
    .averageTouches(true)
    .onUpdate(e => {
      translateX.value = savedTX.value + e.translationX;
      translateY.value = savedTY.value + e.translationY;
    })
    .onEnd(() => {
      const s = scaleVal.value;
      /**
       * Clamping correct : l'origin de la transformation est le coin haut-gauche
       * du Animated.View (qui a width=cw, height=ch).
       * Après scale s (ancré au centre du conteneur vw×vh), le contenu occupe
       * visuellement cw*s × ch*s centré dans le viewport.
       * On calcule les bornes pour que le contenu reste visible.
       */
      const scaledW = cw * s;
      const scaledH = ch * s;
      const OVERSCROLL = 20;
      const minTx = scaledW > vw ? -(scaledW - vw) - OVERSCROLL : -OVERSCROLL;
      const maxTx = OVERSCROLL;
      const naturalMinTx = scaledW > vw ? -(scaledW - vw) : 0;
      const naturalMaxTx = 0;
      let x = translateX.value;
      x = Math.max(minTx, Math.min(maxTx, x));
      const clampedX = Math.max(naturalMinTx, Math.min(naturalMaxTx, x));
      const minTy = scaledH > vh ? -(scaledH - vh) / 2 : 0;
      const maxTy = scaledH > vh ? (scaledH - vh) / 2 : 0;

      const clampedY = Math.max(minTy, Math.min(maxTy, translateY.value));
      translateX.value = withTiming(clampedX);
      translateY.value = withTiming(clampedY);
      savedTX.value = clampedX;
      savedTY.value = clampedY;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onStart(() => {
      scaleVal.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedScale.value = 1;
      savedTX.value = 0;
      savedTY.value = 0;
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .requireExternalGestureToFail(doubleTap)
    .runOnJS(true)
    .onEnd(() => {
      if (onSingleTap) onSingleTap();
    });

  const gesture = Gesture.Simultaneous(
    Gesture.Simultaneous(pinch, pan),
    doubleTap,
    singleTap,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scaleVal.value },
    ],
  }));

  const longStripCalibD = showCalibrationPulse
    ? calibration1mVPath(cellHeight, pxPerMm, amplitude)
    : '';

  const renderGrid = () => {
    const cellProps = {
      cellHeight,
      gridVisible,
      amplitude,
      showCalibrationPulse,
      pxPerMm,
      c,
    };

    if (displayMode === '4x3') {
      return LEAD_ORDER_4X3.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.gridRow}>
          {row.map((lead, colIdx) => (
            <LeadCell
              key={`${lead}_${colIdx}`}
              lead={lead}
              pathD={pathsReady ? pathCache[`${lead}_${colIdx}`] : undefined}
              cellWidth={cellWidth}
              minorGridD={leadMinorGridD}
              majorGridD={leadMajorGridD}
              {...cellProps}
            />
          ))}
        </View>
      ));
    }

    if (displayMode === '6x2') {
      return LEAD_ORDER_6X2.map(([left, right], rowIdx) => (
        <View key={rowIdx} style={styles.gridRow}>
          <LeadCell
            lead={left}
            pathD={pathsReady ? pathCache[`${left}_0`] : undefined}
            cellWidth={cellWidth}
            minorGridD={leadMinorGridD}
            majorGridD={leadMajorGridD}
            {...cellProps}
          />
          <LeadCell
            lead={right}
            pathD={pathsReady ? pathCache[`${right}_1`] : undefined}
            cellWidth={cellWidth}
            minorGridD={leadMinorGridD}
            majorGridD={leadMajorGridD}
            {...cellProps}
          />
        </View>
      ));
    }

    return ([...LEAD_ORDER_12] as string[]).map((lead, idx) => (
      <View key={idx} style={styles.gridRow}>
        <LeadCell
          lead={lead}
          pathD={pathsReady ? pathCache[`${lead}_0`] : undefined}
          cellWidth={totalTraceWidth}
          minorGridD={wideMinorGridD}
          majorGridD={wideMajorGridD}
          {...cellProps}
        />
      </View>
    ));
  };

  const bgColor = c.bg;
  const iiLongD = pathsReady ? pathCache['II_long'] : undefined;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[
          styles.viewport,
          isFullscreen && styles.viewportFullscreen,
          { width: vw, height: vh, backgroundColor: bgColor },
        ]}
      >
        <Animated.View
          style={[
            styles.content,
            { width: cw, height: ch, backgroundColor: bgColor },
            animatedStyle,
          ]}
        >
          {renderGrid()}

          {enrichedHasII && (
            <View style={[styles.longStripRow, { borderTopColor: joyful.neutral.border }]}>
              <Text style={[styles.leadLabel, { width: LABEL_W * numCols, color: c.label }]}>DII</Text>
              <View style={styles.longStripTrace}>
                <Svg width={totalTraceWidth} height={cellHeight}>
                  {gridVisible && (
                    <CalibratedGrid
                      minorD={wideMinorGridD}
                      majorD={wideMajorGridD}
                      width={totalTraceWidth}
                      height={cellHeight}
                      c={c}
                    />
                  )}
                  {longStripCalibD ? (
                    <Path
                      d={longStripCalibD}
                      fill="none"
                      stroke={c.calib}
                      strokeWidth={1.2}
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                    />
                  ) : null}
                  {iiLongD ? (
                    <Path
                      d={iiLongD}
                      fill="none"
                      stroke={c.trace}
                      strokeWidth={1.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : (
                    <Path
                      d={`M0,${cellHeight / 2}H${totalTraceWidth}`}
                      fill="none"
                      stroke={c.gridMinor}
                      strokeWidth={0.5}
                      strokeDasharray="4,2"
                    />
                  )}
                </Svg>
                {caliperEnabled && (
                  <View
                    style={[styles.caliperOverlay, { width: totalTraceWidth }]}
                    pointerEvents="box-none"
                  >
                    <ECGCaliperStrip
                      traceWidth={totalTraceWidth}
                      stripHeight={cellHeight}
                      durationSeconds={duration}
                      pxPerMm={pxPerMm}
                      lineColor={joyful.primary}
                    />
                  </View>
                )}
              </View>
            </View>
          )}
        </Animated.View>

        <View style={styles.scaleTag}>
          <Text style={styles.scaleTagText}>
            {speed} mm/s · {amplitude} mm/mV
            {caliperEnabled ? ' · calibre' : ''}
          </Text>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  viewportFullscreen: {
    borderRadius: 0,
  },
  content: {
    overflow: 'visible',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadLabel: {
    width: LABEL_W,
    fontSize: 10,
    fontWeight: '700',
    paddingLeft: 3,
  },
  longStripRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
  },
  longStripTrace: {
    position: 'relative',
  },
  caliperOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    minHeight: 40,
  },
  scaleTag: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.10)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  scaleTagText: {
    color: '#333',
    fontSize: 9,
    fontWeight: '600',
  },
});
