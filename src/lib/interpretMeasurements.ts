/** Entier > 0 pour les mesures envoyées au backend (FC bpm, intervalles ms). */
export function parseMeasurementInt(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(n) || n <= 0 || n > 9999) return undefined;
  return n;
}

export function buildMeasurementsPayload(
  heartRate: string,
  prInterval: string,
  qrsDuration: string,
  qtInterval: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  const hr = parseMeasurementInt(heartRate);
  if (hr !== undefined) out.heartRate = hr;
  const pr = parseMeasurementInt(prInterval);
  if (pr !== undefined) out.prInterval = pr;
  const qrs = parseMeasurementInt(qrsDuration);
  if (qrs !== undefined) out.qrsDuration = qrs;
  const qt = parseMeasurementInt(qtInterval);
  if (qt !== undefined) out.qtInterval = qt;
  return out;
}
