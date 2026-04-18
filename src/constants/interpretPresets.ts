import type { Locale } from '@/i18n';

export const RHYTHM_PRESETS_FR = [
  'Rythme sinusal',
  'Fibrillation auriculaire',
  'Flutter auriculaire',
  'Tachycardie ventriculaire',
  'Bradycardie sinusale',
  'Bloc auriculo-ventriculaire',
  'Extrasystoles ventriculaires',
  'Bloc de branche droit',
  'Bloc de branche gauche',
  'Autre',
] as const;

export const RHYTHM_PRESETS_EN = [
  'Sinus rhythm',
  'Atrial fibrillation',
  'Atrial flutter',
  'Ventricular tachycardia',
  'Sinus bradycardia',
  'AV block',
  'Ventricular extrasystoles',
  'Right bundle branch block',
  'Left bundle branch block',
  'Other',
] as const;

export const AXIS_PRESETS_FR = ['Normal', 'Dévié à gauche', 'Dévié à droite', 'Indéterminé'] as const;
export const AXIS_PRESETS_EN = ['Normal', 'Left axis deviation', 'Right axis deviation', 'Indeterminate'] as const;

export function getRhythmPresets(locale: Locale): string[] {
  return locale === 'en' ? [...RHYTHM_PRESETS_EN] : [...RHYTHM_PRESETS_FR];
}

export function getAxisPresets(locale: Locale): string[] {
  return locale === 'en' ? [...AXIS_PRESETS_EN] : [...AXIS_PRESETS_FR];
}
