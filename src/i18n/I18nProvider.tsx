import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fr, type TranslationKeys } from './fr';
import { en } from './en';

export type Locale = 'fr' | 'en';

const STORAGE_KEY = '@xpress_ecg_locale';

const dictionaries: Record<Locale, TranslationKeys> = { fr, en };

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TranslationKeys;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectDeviceLocale(): Locale {
  try {
    const raw =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ??
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;
    if (typeof raw === 'string' && raw.startsWith('en')) return 'en';
  } catch {
    // fallback
  }
  return 'fr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'fr' || v === 'en') {
        setLocaleState(v);
      } else {
        setLocaleState(detectDeviceLocale());
      }
    });
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    void AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useMemo(() => dictionaries[locale], [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return { locale: 'fr', setLocale: () => {}, t: fr };
  }
  return ctx;
}
