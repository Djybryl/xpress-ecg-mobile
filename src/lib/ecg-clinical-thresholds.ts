export const ECG_THRESHOLDS = {
  fc:        { criticalLow: 40, warnLow: 50, warnHigh: 100, criticalHigh: 150 },
  pr:        { warnHigh: 200, criticalHigh: 300 },
  qrs:       { warnHigh: 120, criticalHigh: 160 },
  qtcMale:   { warnHigh: 440, criticalHigh: 500 },
  qtcFemale: { warnHigh: 460, criticalHigh: 500 },
  sokolow:   { warnHigh: 35,  criticalHigh: 45  },
} as const;

export type AlertLevel = 'critical' | 'warning' | 'normal';

/**
 * Évalue le niveau d'alerte clinique pour un champ de mesure ECG.
 * Retourne 'normal' si la valeur est absente ou nulle.
 */
export function getAlertLevel(
  field: 'fc' | 'pr' | 'qrs' | 'qtc' | 'sokolow',
  value: number | string | undefined,
  gender?: string | null,
): AlertLevel {
  const v = typeof value === 'string' ? parseFloat(value) : value;
  if (v == null || isNaN(v) || v === 0) return 'normal';

  const thresholds: Record<string, number | undefined> =
    field === 'qtc'
      ? (gender === 'F' ? ECG_THRESHOLDS.qtcFemale : ECG_THRESHOLDS.qtcMale)
      : (ECG_THRESHOLDS[field] as Record<string, number | undefined>);

  const { criticalHigh, criticalLow, warnHigh, warnLow } = thresholds as {
    criticalHigh?: number;
    criticalLow?: number;
    warnHigh?: number;
    warnLow?: number;
  };

  if ((criticalHigh != null && v >= criticalHigh) || (criticalLow != null && v <= criticalLow)) {
    return 'critical';
  }
  if ((warnHigh != null && v >= warnHigh) || (warnLow != null && v <= warnLow)) {
    return 'warning';
  }
  return 'normal';
}
