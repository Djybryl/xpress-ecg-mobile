import type { TranslationKeys } from '@/i18n/fr';
import { ApiError } from './apiClient';

const CODE = 'SOLIDARITY_THRESHOLD_NOT_MET';

export function isSolidarityThresholdApiError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === CODE;
}

type ParsedDetails = {
  done: number;
  required: number;
  freeCompleted: number;
  urgentCompleted: number;
};

function parseDetails(raw: unknown): ParsedDetails {
  if (!raw || typeof raw !== 'object') {
    return { done: 0, required: 0, freeCompleted: 0, urgentCompleted: 0 };
  }
  const o = raw as Record<string, unknown>;
  const n = (v: unknown) => {
    const x = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(x) ? Math.trunc(x) : 0;
  };
  return {
    done: n(o.done),
    required: n(o.required),
    freeCompleted: n(o.freeCompleted),
    urgentCompleted: n(o.urgentCompleted),
  };
}

function applyTemplate(template: string, d: ParsedDetails): string {
  return template
    .replace(/\{\{done\}\}/g, String(d.done))
    .replace(/\{\{required\}\}/g, String(d.required))
    .replace(/\{\{free\}\}/g, String(d.freeCompleted))
    .replace(/\{\{urgent\}\}/g, String(d.urgentCompleted));
}

/** Titre + message localisés pour Alert (403 start-analysis). */
export function solidarityGateAlertContent(
  err: ApiError,
  copy: TranslationKeys['solidarity'],
): { title: string; message: string } {
  const d = parseDetails(err.details);
  return {
    title: copy.gateAlertTitle,
    message: applyTemplate(copy.gateAlertBody, d),
  };
}
