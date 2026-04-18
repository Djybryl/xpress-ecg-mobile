/**
 * Utilitaires ECG portables — filtres, dérivation de leads, conversion samples → path SVG.
 * Porté depuis le web ECGWaveformViewer + ecg-filters.ts pour React Native.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EcgSignalData {
  format: string;
  sample_rate: number;
  duration_seconds: number;
  leads: string[];
  samples: Record<string, number[]>;
  metadata?: Record<string, unknown> | null;
}

export type DisplayMode = '4x3' | '6x2' | '1x12';

/** Calibration ECG standard mobile (dp par mm) */
export const PX_PER_MM_MOBILE = 3;
/** Hauteur d'une rangée en mm (6 grands carreaux) */
export const ROW_HEIGHT_MM = 30;

// ─── Constantes de layout ───────────────────────────────────────────────────

export const LEAD_ORDER_4X3: string[][] = [
  ['I', 'aVR', 'V1', 'V4'],
  ['II', 'aVL', 'V2', 'V5'],
  ['III', 'aVF', 'V3', 'V6'],
];

export const LEAD_ORDER_6X2: [string, string][] = [
  ['I', 'V1'], ['II', 'V2'], ['III', 'V3'],
  ['aVR', 'V4'], ['aVL', 'V5'], ['aVF', 'V6'],
];

export const LEAD_ORDER_12 = [
  'I', 'II', 'III', 'aVR', 'aVL', 'aVF',
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6',
] as const;

// ─── Dérivation de leads manquants (III, aVR, aVL, aVF) ────────────────────

const LEAD_I_ALIASES = ['I', 'dI', 'D1'];
const LEAD_II_ALIASES = ['II', 'dII', 'D2'];

export function enrichSignalWithDerivedLeads(signal: EcgSignalData): EcgSignalData {
  const { leads, samples } = signal;
  let newLeads = [...leads];
  let newSamples = { ...samples };

  const canonicalMappings: [string, string][] = [
    ['AVR', 'aVR'], ['AVL', 'aVL'], ['AVF', 'aVF'], ['D3', 'III'],
    ['dI', 'I'], ['D1', 'I'], ['dII', 'II'], ['D2', 'II'],
  ];
  for (const [variant, canonical] of canonicalMappings) {
    if (samples[variant]?.length && !newSamples[canonical]) {
      newSamples = { ...newSamples, [canonical]: samples[variant] };
      if (!newLeads.includes(canonical)) newLeads.push(canonical);
    }
  }

  const getLead = (aliases: string[]): number[] | null => {
    for (const name of aliases) {
      const s = newSamples[name] ?? samples[name];
      if (s?.length) return s;
    }
    return null;
  };

  const iS = getLead(LEAD_I_ALIASES);
  const iiS = getLead(LEAD_II_ALIASES);
  if (!iS || !iiS) return signal;

  const n = Math.min(iS.length, iiS.length);
  const allKeys = Object.keys(newSamples);

  if (!newLeads.includes('III') && !allKeys.some(k => /^III$/i.test(k))) {
    newSamples.III = Array.from({ length: n }, (_, i) => iiS[i] - iS[i]);
    newLeads.push('III');
  }
  if (!newLeads.includes('aVR') && !allKeys.some(k => /^a?vr$/i.test(k))) {
    newSamples.aVR = Array.from({ length: n }, (_, i) => -(iS[i] + iiS[i]) / 2);
    newLeads.push('aVR');
  }
  if (!newLeads.includes('aVL') && !allKeys.some(k => /^a?vl$/i.test(k))) {
    newSamples.aVL = Array.from({ length: n }, (_, i) => iS[i] - iiS[i] / 2);
    newLeads.push('aVL');
  }
  if (!newLeads.includes('aVF') && !allKeys.some(k => /^a?vf$/i.test(k))) {
    newSamples.aVF = Array.from({ length: n }, (_, i) => iiS[i] - iS[i] / 2);
    newLeads.push('aVF');
  }

  return { ...signal, leads: newLeads, samples: newSamples };
}

// ─── Correction baseline ────────────────────────────────────────────────────

export function removeBaseline(samples: number[]): number[] {
  if (!samples.length) return samples;
  const step = samples.length > 2000 ? 8 : 1;
  const decimated: number[] = [];
  for (let i = 0; i < samples.length; i += step) decimated.push(samples[i]);
  const arr = decimated.sort((a, b) => a - b);
  const median = arr.length % 2 === 1
    ? arr[(arr.length - 1) / 2]
    : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2;
  if (Math.abs(median) < 1e-12) return samples;
  return samples.map(v => v - median);
}

// ─── Filtres Biquad Butterworth ─────────────────────────────────────────────

interface BiquadCoef { b0: number; b1: number; b2: number; a1: number; a2: number }

const Q_BW = 1 / Math.SQRT2;

function lowpassCoef(fc: number, fs: number, q = Q_BW): BiquadCoef {
  const w0 = (2 * Math.PI * fc) / fs;
  const cos0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = (1 - cos0) / 2;
  const a0 = 1 + alpha;
  return { b0: b0 / a0, b1: (1 - cos0) / a0, b2: b0 / a0, a1: (-2 * cos0) / a0, a2: (1 - alpha) / a0 };
}

function highpassCoef(fc: number, fs: number, q = Q_BW): BiquadCoef {
  const w0 = (2 * Math.PI * fc) / fs;
  const cos0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = (1 + cos0) / 2;
  const a0 = 1 + alpha;
  return { b0: b0 / a0, b1: -(1 + cos0) / a0, b2: b0 / a0, a1: (-2 * cos0) / a0, a2: (1 - alpha) / a0 };
}

function notchCoef(fc: number, fs: number, q = 10): BiquadCoef {
  const w0 = (2 * Math.PI * fc) / fs;
  const cos0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return { b0: 1 / a0, b1: (-2 * cos0) / a0, b2: 1 / a0, a1: (-2 * cos0) / a0, a2: (1 - alpha) / a0 };
}

function applyBiquad(samples: number[], coef: BiquadCoef): number[] {
  const out: number[] = new Array(samples.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = coef.b0 * x0 + coef.b1 * x1 + coef.b2 * x2 - coef.a1 * y1 - coef.a2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return out;
}

export interface EcgFilterOptions {
  lowPass40?: boolean;
  highPass005?: boolean;
  notch50?: boolean;
  smoothLevel?: 0 | 1 | 2;
}

export function applyEcgFilters(
  samples: number[],
  fs: number,
  opts: EcgFilterOptions,
): number[] {
  let data = samples;
  if (opts.highPass005 && fs > 1) data = applyBiquad(data, highpassCoef(0.5, fs));
  if (opts.lowPass40 && fs > 80) data = applyBiquad(data, lowpassCoef(40, fs));
  if (opts.notch50 && fs > 100) data = applyBiquad(data, notchCoef(50, fs));
  if (opts.smoothLevel && opts.smoothLevel >= 2 && fs > 60) {
    data = applyBiquad(data, lowpassCoef(30, fs));
  }
  return data;
}

// ─── Échantillonnage & Path SVG ─────────────────────────────────────────────

const MAX_POINTS_MOBILE = 2000;

export function limitSamples(samples: number[], maxPoints: number = MAX_POINTS_MOBILE): number[] {
  if (samples.length <= maxPoints) return samples;
  const step = samples.length / maxPoints;
  const result: number[] = new Array(maxPoints);
  for (let i = 0; i < maxPoints; i++) {
    result[i] = samples[Math.min(Math.floor(i * step), samples.length - 1)];
  }
  return result;
}

export function samplesToSmoothPath(
  samples: number[],
  width: number,
  height: number,
  amplitude: number = 10,
  pxPerMm?: number,
): string {
  if (samples.length < 2) return '';

  const centerY = height / 2;
  let scaleY: number;
  let offsetY: number;

  if (pxPerMm) {
    scaleY = pxPerMm * amplitude;
    offsetY = 0;
  } else {
    const margin = height * 0.08;
    const usableHeight = height - 2 * margin;
    const minV = Math.min(...samples);
    const maxV = Math.max(...samples);
    const range = maxV - minV;
    scaleY = range > 1e-9
      ? usableHeight / range
      : (height / 10) * amplitude;
    offsetY = range > 1e-9 ? (minV + maxV) / 2 : 0;
  }
  const stepX = width / Math.max(1, samples.length - 1);

  const pts = samples.map((v, i) => ({
    x: i * stepX,
    y: centerY - (v - offsetY) * scaleY,
  }));

  const tau = 1 / 6;
  const seg: string[] = [`M ${pts[0].x},${pts[0].y}`];

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    seg.push(
      `C ${p1.x + (p2.x - p0.x) * tau},${p1.y + (p2.y - p0.y) * tau} ` +
      `${p2.x - (p3.x - p1.x) * tau},${p2.y - (p3.y - p1.y) * tau} ` +
      `${p2.x},${p2.y}`,
    );
  }

  return seg.join(' ');
}

// ─── Helpers pour le layout ─────────────────────────────────────────────────

export function getLeadsForMode(mode: DisplayMode, availableLeads: string[]): string[] {
  switch (mode) {
    case '4x3':
      return LEAD_ORDER_4X3.flat().filter(l => availableLeads.includes(l));
    case '6x2':
      return LEAD_ORDER_6X2.flatMap(([a, b]) => [a, b]).filter(l => availableLeads.includes(l));
    case '1x12':
      return [...LEAD_ORDER_12].filter(l => availableLeads.includes(l));
  }
}

export function getNumCols(mode: DisplayMode): number {
  return mode === '4x3' ? 4 : mode === '6x2' ? 2 : 1;
}

export function getNumRows(mode: DisplayMode): number {
  return mode === '4x3' ? 3 : mode === '6x2' ? 6 : 12;
}

function normalizeToMillivolts(data: number[]): number[] {
  if (data.length < 10) return data;
  let maxAbs = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i] < 0 ? -data[i] : data[i];
    if (a > maxAbs) maxAbs = a;
  }
  return maxAbs > 50 ? data.map(v => v / 1000) : data;
}

/**
 * Génère les paths SVG pour toutes les cellules du layout.
 * Retourne Record<`${lead}_${col}`, path_d_string>.
 * Si pxPerMm est fourni, utilise l'échelle calibrée (mm/mV fixe).
 */
export function buildPathCache(
  signal: EcgSignalData,
  mode: DisplayMode,
  amplitude: number,
  cellWidth: number,
  cellHeight: number,
  filterOpts: EcgFilterOptions,
  pxPerMm?: number,
): Record<string, string> {
  const enriched = enrichSignalWithDerivedLeads(signal);
  const { samples, sample_rate: fs } = enriched;
  const numCols = getNumCols(mode);
  const segDur = enriched.duration_seconds / numCols;
  const cache: Record<string, string> = {};

  const flatLeads = mode === '4x3'
    ? LEAD_ORDER_4X3.flat()
    : mode === '6x2'
      ? LEAD_ORDER_6X2.flatMap(([a, b]) => [a, b])
      : [...LEAD_ORDER_12];

  flatLeads.forEach((lead, idx) => {
    const colIdx = idx % numCols;
    const s = samples[lead];
    if (!s) return;

    const filtered = applyEcgFilters(s, fs, filterOpts);
    const tStart = Math.floor(colIdx * segDur * fs);
    const tEnd = Math.min(s.length, Math.ceil((colIdx + 1) * segDur * fs));
    const segment = filtered.slice(tStart, tEnd);
    const corrected = removeBaseline(segment);
    const normalized = pxPerMm ? normalizeToMillivolts(corrected) : corrected;
    const limited = limitSamples(normalized, MAX_POINTS_MOBILE);

    cache[`${lead}_${colIdx}`] = samplesToSmoothPath(limited, cellWidth, cellHeight, amplitude, pxPerMm);
  });

  if (samples.II?.length) {
    const totalWidth = cellWidth * numCols;
    const filtered = applyEcgFilters(samples.II, fs, filterOpts);
    const corrected = removeBaseline(filtered);
    const normalized = pxPerMm ? normalizeToMillivolts(corrected) : corrected;
    const limited = limitSamples(normalized, MAX_POINTS_MOBILE * 2);
    cache['II_long'] = samplesToSmoothPath(limited, totalWidth, cellHeight, amplitude, pxPerMm);
  }

  return cache;
}
