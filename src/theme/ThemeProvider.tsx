import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme, type ColorSchemeName } from 'react-native';

import { palette } from './designTokens';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedColorScheme = Exclude<ColorSchemeName, null | undefined>;

const THEME_STORAGE_KEY = 'tdf-mobile/theme-preference';

export const semanticColors = {
  light: {
    canvas: palette.surface,
    surface: palette.background,
    surfaceRaised: '#ffffff',
    surfaceMuted: '#f1f5f9',
    textPrimary: palette.text,
    textSecondary: palette.textSecondary,
    border: '#94949a',
    borderSubtle: '#cbd5e1',
    actionPrimary: palette.primaryDark,
    actionPrimaryPressed: '#6d28d9',
    actionPrimaryContrast: '#ffffff',
    selected: '#ede9fe',
    danger: '#b91c1c',
    dangerAction: '#b91c1c',
    dangerActionContrast: '#ffffff',
    dangerSurface: '#fef2f2',
    dangerBorder: '#be123c',
    success: '#166534',
    infoSurface: '#ecfeff',
    infoBorder: '#0e7490',
    warningSurface: '#fff7ed',
    warningBorder: '#c2410c',
    overlay: 'rgba(0, 0, 0, 0.45)',
  },
  dark: {
    canvas: palette.backgroundDark,
    surface: palette.surfaceDark,
    surfaceRaised: '#1b1b26',
    surfaceMuted: '#27272a',
    textPrimary: palette.textDark,
    textSecondary: palette.textSecondaryDark,
    border: '#71717a',
    borderSubtle: '#52525b',
    actionPrimary: '#a78bfa',
    actionPrimaryPressed: '#c4b5fd',
    actionPrimaryContrast: '#111113',
    selected: '#2e1065',
    danger: '#fda4af',
    dangerAction: '#be123c',
    dangerActionContrast: '#ffffff',
    dangerSurface: '#450a0a',
    dangerBorder: '#fb7185',
    success: '#86efac',
    infoSurface: '#164e63',
    infoBorder: '#67e8f9',
    warningSurface: '#431407',
    warningBorder: '#fb923c',
    overlay: 'rgba(0, 0, 0, 0.68)',
  },
} as const;

interface AppThemeContextValue {
  colorScheme: ResolvedColorScheme;
  preference: ThemePreference;
  colors: (typeof semanticColors)[ResolvedColorScheme];
  setPreference: (preference: ThemePreference) => void;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme() ?? 'light';
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (active && isThemePreference(stored)) setPreference(stored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void AsyncStorage.setItem(THEME_STORAGE_KEY, preference).catch(() => undefined);
  }, [loaded, preference]);

  const colorScheme: ResolvedColorScheme = preference === 'system' ? systemColorScheme : preference;
  const value = useMemo<AppThemeContextValue>(
    () => ({ colorScheme, preference, colors: semanticColors[colorScheme], setPreference }),
    [colorScheme, preference],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return context;
}
