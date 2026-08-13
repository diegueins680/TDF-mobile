import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme, type ColorSchemeName } from 'react-native';

import { palette } from './designTokens';
import { useUserSettings } from '../providers/UserSettingsProvider';

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
  preferenceId: string;
  options: readonly ThemeModeOption[];
  catalogSource: 'network' | 'emergency';
  colors: (typeof semanticColors)[ResolvedColorScheme];
  setPreferenceById: (preferenceId: string) => void;
}

export interface ThemeModeOption {
  id: string;
  code: ThemePreference;
  label: string;
}

interface StoredThemeSelection {
  id: string | null;
  code: ThemePreference;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function parseStoredThemeSelection(raw: string | null): StoredThemeSelection | null {
  if (isThemePreference(raw)) return { id: null, code: raw };
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    if (!isThemePreference(value.code)) return null;
    return { id: typeof value.id === 'string' && value.id ? value.id : null, code: value.code };
  } catch {
    return null;
  }
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const { getCatalogItems, getCatalogDefaults, catalogSource } = useUserSettings();
  const systemColorScheme = useColorScheme() ?? 'light';
  const options = useMemo<ThemeModeOption[]>(
    () => getCatalogItems('appearance-modes').flatMap((item) => (
      isThemePreference(item.code)
        ? [{ id: item.id, code: item.code, label: item.name }]
        : []
    )),
    [getCatalogItems],
  );
  const defaultEntityId = getCatalogDefaults('appearance-modes').find(
    (entry) => entry.scopeKind === 'appearance-mode' && entry.scopeId === 'global' && !entry.localeId,
  )?.entityId;
  const defaultOption = options.find((option) => option.id === defaultEntityId) ?? options[0];
  const [selection, setSelection] = useState<StoredThemeSelection>({ id: null, code: 'system' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        const parsed = parseStoredThemeSelection(stored);
        if (active && parsed) setSelection(parsed);
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
    if (!loaded || !defaultOption) return;
    const selected = options.find((option) => option.id === selection.id)
      ?? options.find((option) => option.code === selection.code)
      ?? defaultOption;
    if (selection.id !== selected.id || selection.code !== selected.code) {
      setSelection({ id: selected.id, code: selected.code });
    }
  }, [defaultOption, loaded, options, selection.code, selection.id]);

  useEffect(() => {
    if (!loaded || !selection.id) return;
    void AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(selection)).catch(() => undefined);
  }, [loaded, selection]);

  const setPreferenceById = useCallback((preferenceId: string) => {
    const next = options.find((option) => option.id === preferenceId);
    if (next) setSelection({ id: next.id, code: next.code });
  }, [options]);

  const preference = selection.code;
  const colorScheme: ResolvedColorScheme = preference === 'system' ? systemColorScheme : preference;
  const value = useMemo<AppThemeContextValue>(
    () => ({
      colorScheme,
      preference,
      preferenceId: selection.id ?? defaultOption?.id ?? '',
      options,
      catalogSource,
      colors: semanticColors[colorScheme],
      setPreferenceById,
    }),
    [catalogSource, colorScheme, defaultOption?.id, options, preference, selection.id, setPreferenceById],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return context;
}
