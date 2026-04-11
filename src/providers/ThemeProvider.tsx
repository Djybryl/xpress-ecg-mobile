import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useNWColorScheme } from 'nativewind';
import { getJoyfulColors, type JoyfulColors } from '@/theme/joyful';

const STORAGE_KEY = '@xpress_ecg_theme_preference';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  isDark: boolean;
  colors: JoyfulColors;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [hydrated, setHydrated] = useState(false);
  const systemScheme = useRNColorScheme();
  const { setColorScheme } = useNWColorScheme();

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') {
        setPreferenceState(v);
      }
      setHydrated(true);
    });
  }, []);

  const setPreference = useCallback(
    (p: ThemePreference) => {
      setPreferenceState(p);
      void AsyncStorage.setItem(STORAGE_KEY, p);
      setColorScheme(p);
    },
    [setColorScheme],
  );

  useEffect(() => {
    if (!hydrated) return;
    setColorScheme(preference);
  }, [hydrated, preference, setColorScheme]);

  const isDark =
    preference === 'dark' || (preference === 'system' && systemScheme === 'dark');

  const colors = useMemo(() => getJoyfulColors(isDark), [isDark]);

  const value = useMemo(
    () => ({ preference, setPreference, isDark, colors }),
    [preference, setPreference, isDark, colors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme doit être utilisé dans ThemeProvider');
  }
  return ctx;
}
