/**
 * Deux curseurs verticaux sur la bande DII (pleine durée) pour mesurer Δt et Δdistance papier.
 * Utilise PanResponder (thread JS) pour éviter les conflits worklet / refs.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';

interface ECGCaliperStripProps {
  traceWidth: number;
  stripHeight: number;
  durationSeconds: number;
  pxPerMm: number;
  lineColor: string;
}

function clampNum(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function ECGCaliperStrip({
  traceWidth,
  stripHeight,
  durationSeconds,
  pxPerMm,
  lineColor,
}: ECGCaliperStripProps) {
  const [a, setA] = useState(() => Math.max(8, traceWidth * 0.22));
  const [b, setB] = useState(() => Math.max(16, traceWidth * 0.58));
  const startA = useRef(0);
  const startB = useRef(0);
  const aRef = useRef(a);
  const bRef = useRef(b);
  aRef.current = a;
  bRef.current = b;

  useEffect(() => {
    setA(Math.max(8, traceWidth * 0.22));
    setB(Math.max(16, traceWidth * 0.58));
  }, [traceWidth]);

  const panA = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startA.current = aRef.current;
        },
        onPanResponderMove: (_, g) => {
          setA(clampNum(startA.current + g.dx, 0, traceWidth));
        },
      }),
    [traceWidth],
  );

  const panB = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startB.current = bRef.current;
        },
        onPanResponderMove: (_, g) => {
          setB(clampNum(startB.current + g.dx, 0, traceWidth));
        },
      }),
    [traceWidth],
  );

  const deltaPx = Math.abs(a - b);
  const dtMs = traceWidth > 0 ? (deltaPx / traceWidth) * durationSeconds * 1000 : 0;
  const dMm = deltaPx / pxPerMm;

  if (traceWidth <= 0) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.stripBox, { width: traceWidth, height: stripHeight }]} pointerEvents="box-none">
        <View
          style={[styles.cursor, { left: a - 10, height: stripHeight }]}
          {...panA.panHandlers}
        >
          <View style={[styles.cursorLine, { backgroundColor: lineColor }]} />
          <Text style={styles.cursorTag}>A</Text>
        </View>
        <View
          style={[styles.cursor, { left: b - 10, height: stripHeight }]}
          {...panB.panHandlers}
        >
          <View style={[styles.cursorLine, { backgroundColor: lineColor }]} />
          <Text style={styles.cursorTag}>B</Text>
        </View>
      </View>
      <Text style={styles.measureText}>
        Δt ≈ {dtMs.toFixed(0)} ms · Δx ≈ {dMm.toFixed(1)} mm papier
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 2,
  },
  stripBox: {
    position: 'relative',
  },
  cursor: {
    position: 'absolute',
    top: 0,
    width: 20,
    zIndex: 10,
  },
  cursorLine: {
    position: 'absolute',
    left: 9,
    top: 0,
    width: 2,
    height: '100%',
    opacity: 0.85,
  },
  cursorTag: {
    position: 'absolute',
    top: -2,
    left: 0,
    fontSize: 9,
    fontWeight: '800',
    color: '#6366f1',
  },
  measureText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6366f1',
    marginTop: 4,
    paddingLeft: 2,
  },
});
