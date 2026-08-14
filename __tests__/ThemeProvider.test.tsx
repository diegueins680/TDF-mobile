import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppThemeProvider, useAppTheme } from '../src/theme/ThemeProvider';

const mockThemeItems = [
  { id: 'appearance-system', code: 'system', name: 'Sistema' },
  { id: 'appearance-light', code: 'light', name: 'Claro' },
  { id: 'appearance-dark', code: 'dark', name: 'Oscuro' },
];

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({
    getCatalogItems: (code: string) => code === 'appearance-modes' ? mockThemeItems : [],
    getCatalogDefaults: (code: string) => code === 'appearance-modes'
      ? [{ entityId: 'appearance-system', scopeKind: 'appearance-mode', scopeId: 'global', version: 1 }]
      : [],
    catalogSource: 'network',
  }),
}));

function ThemeWrapper({ children }: PropsWithChildren) {
  return <AppThemeProvider>{children}</AppThemeProvider>;
}

describe('AppThemeProvider', () => {
  const getItemMock = jest.mocked(AsyncStorage.getItem);
  const setItemMock = jest.mocked(AsyncStorage.setItem);

  beforeEach(() => {
    jest.clearAllMocks();
    getItemMock.mockResolvedValue(null);
    setItemMock.mockResolvedValue();
  });

  it('restores and persists an explicit accessible color scheme', async () => {
    getItemMock.mockResolvedValueOnce('dark');
    const { result } = renderHook(() => useAppTheme(), { wrapper: ThemeWrapper });

    await waitFor(() => expect(result.current.preference).toBe('dark'));
    expect(result.current.colorScheme).toBe('dark');
    expect(result.current.colors.actionPrimaryContrast).toBe('#111113');
    expect(result.current.colors.surfaceRaised).toBe('#1b1b26');
    expect(result.current.colors.dangerSurface).toBe('#450a0a');
    expect(result.current.colors.warningBorder).toBe('#fb923c');

    expect(result.current.preferenceId).toBe('appearance-dark');

    act(() => result.current.setPreferenceById('appearance-light'));

    await waitFor(() => {
      expect(setItemMock).toHaveBeenLastCalledWith(
        'tdf-mobile/theme-preference',
        JSON.stringify({ id: 'appearance-light', code: 'light' }),
      );
    });
    expect(result.current.colors.actionPrimary).toBe('#7c3aed');
    expect(result.current.colors.surfaceRaised).toBe('#ffffff');
    expect(result.current.colors.infoBorder).toBe('#0e7490');
  });
});
