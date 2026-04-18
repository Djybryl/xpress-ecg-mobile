/**
 * Extraction des mesures ECG affichables depuis les métadonnées signal
 * et/ou le champ enregistrement API (heart_rate).
 */

export interface EcgMeasurementsDisplay {
  heartRateBpm: number | null;
  prMs: number | null;
  qrsMs: number | null;
  qtMs: number | null;
  qtcMs: number | null;
}

function readNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.').trim());
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return null;
}

function pick(meta: Record<string, unknown> | undefined, keys: string[]): number | null {
  if (!meta) return null;
  for (const k of keys) {
    if (k in meta) {
      const n = readNumber(meta[k]);
      if (n !== null) return n;
    }
  }
  return null;
}

/**
 * Fusionne les métadonnées du signal parsé et la FC éventuelle du dossier ECG.
 */
export function extractEcgMeasurements(
  signalMeta: Record<string, unknown> | undefined,
  recordHeartRate: number | null | undefined,
): EcgMeasurementsDisplay {
  const hrFromMeta = pick(signalMeta, [
    'heart_rate', 'heartRate', 'HeartRate', 'HR', 'hr', 'fc', 'FC', 'ventricular_rate',
  ]);
  const hr = recordHeartRate != null && Number.isFinite(recordHeartRate)
    ? recordHeartRate
    : hrFromMeta;

  return {
    heartRateBpm: hr,
    prMs: pick(signalMeta, ['pr_ms', 'pr', 'PR', 'pr_interval', 'PR_interval']),
    qrsMs: pick(signalMeta, ['qrs_ms', 'qrs', 'QRS', 'qrs_duration']),
    qtMs: pick(signalMeta, ['qt_ms', 'qt', 'QT', 'qt_interval']),
    qtcMs: pick(signalMeta, ['qtc_ms', 'qtc', 'QTc', 'qtc_bazett', 'QTcB']),
  };
}

export function hasAnyMeasurement(m: EcgMeasurementsDisplay): boolean {
  return (
    m.heartRateBpm != null ||
    m.prMs != null ||
    m.qrsMs != null ||
    m.qtMs != null ||
    m.qtcMs != null
  );
}
