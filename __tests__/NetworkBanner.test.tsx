import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockUseUserSettings = jest.fn(() => ({ locale: 'en' }));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => mockUseUserSettings(),
}));

jest.mock('../src/theme/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: { dangerAction: '#b91c1c', dangerActionContrast: '#ffffff' },
  }),
}));

jest.mock('../src/hooks/useReduceMotion', () => ({
  useReduceMotion: () => true,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));

const { NetworkBanner } = require('../src/providers/NetworkProvider');

describe('NetworkBanner', () => {
  it('uses the active locale and stays below the status-bar safe area', () => {
    render(<NetworkBanner />);

    const alert = screen.getByRole('alert');
    expect(screen.getByText('No connection')).toBeTruthy();
    expect(StyleSheet.flatten(alert.props.style)).toMatchObject({ top: 24 });
  });
});
