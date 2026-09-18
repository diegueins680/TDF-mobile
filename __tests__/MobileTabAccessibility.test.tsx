import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import TabsLayout from '../app/(tabs)/_layout';
import { useAuth } from '../src/providers/AuthProvider';
import { useUserSettings } from '../src/providers/UserSettingsProvider';

jest.mock('../src/providers/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/providers/UserSettingsProvider', () => ({ useUserSettings: jest.fn() }));
jest.mock('../src/theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('../src/experiments/NewUserOnboardingGate', () => ({
  NewUserOnboardingGate: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 24 }) }));
jest.mock('expo-router', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  const Tabs = ({ children, screenOptions }: { children: React.ReactNode; screenOptions: { tabBarStyle: { height?: number } } }) => <View testID="tab-bar" style={screenOptions.tabBarStyle}>{children}</View>;
  Tabs.Screen = function MockScreen({ options }: { options: { href?: null; title?: string; tabBarAccessibilityLabel?: string; tabBarLabel?: (props: { color: string }) => React.ReactNode } }) {
    return options.href === null ? null : <View accessibilityLabel={options.tabBarAccessibilityLabel}>
      {options.tabBarLabel ? options.tabBarLabel({ color: '#fff' }) : <Text>{options.title}</Text>}
    </View>;
  };
  return { Tabs };
});

const auth = jest.mocked(useAuth);
const settings = jest.mocked(useUserSettings);
const session = (token: string | null) => auth.mockReturnValue({ token, loading: false } as ReturnType<typeof useAuth>);
const locale = (value: string) => settings.mockReturnValue({ locale: value } as ReturnType<typeof useUserSettings>);

beforeEach(() => { session('synthetic'); locale('es-EC'); });

test('actual tab layout counts five visible destinations, excluding seven hidden routes', () => {
  const screen = render(<TabsLayout />);
  expect(screen.getByLabelText('Directorio, pestaña 1 de 5')).toBeTruthy();
  expect(screen.getByLabelText('Perfil, pestaña 5 de 5')).toBeTruthy();
  expect(screen.queryByLabelText(/of 12|de 12/)).toBeNull();
});

test('changing locale rerenders existing tab titles and accessibility labels', () => {
  const screen = render(<TabsLayout />);
  locale('en-US');
  screen.rerender(<TabsLayout />);
  expect(screen.getByText('Directory')).toBeTruthy();
  expect(screen.getByLabelText('Profile, tab 5 of 5')).toBeTruthy();
  expect(screen.queryByText('Perfil')).toBeNull();
  locale('es');
  screen.rerender(<TabsLayout />);
  expect(screen.getByLabelText('Perfil, pestaña 5 de 5')).toBeTruthy();
});

test('signing out retains only the public tab with the current visible count', () => {
  const screen = render(<TabsLayout />);
  session(null);
  screen.rerender(<TabsLayout />);
  expect(screen.getByLabelText('Directorio, pestaña 1 de 1')).toBeTruthy();
  expect(screen.queryByText('Perfil')).toBeNull();
  expect(screen.queryByText('Crear')).toBeNull();
});

test('session loading is named in the selected locale', () => {
  auth.mockReturnValue({ token: null, loading: true } as ReturnType<typeof useAuth>);
  locale('en');
  const screen = render(<TabsLayout />);
  expect(screen.getByLabelText('Loading session')).toBeTruthy();
  locale('es');
  screen.rerender(<TabsLayout />);
  expect(screen.getByLabelText('Cargando sesión')).toBeTruthy();
});

test('wrapped native labels retain text scaling and reserve measured lines above the safe area', () => {
  const screen = render(<TabsLayout />);
  const label = screen.getByText('Directorio');
  expect(label.props.allowFontScaling).toBe(true);
  expect(label.props.numberOfLines).toBeUndefined();
  fireEvent(label, 'textLayout', { nativeEvent: { lines: [{ y: 0, height: 28 }, { y: 28, height: 28 }] } });
  expect(screen.getByTestId('tab-bar').props.style.height).toBeGreaterThanOrEqual(24 + 56 + 40);
  expect(screen.getByLabelText('Directorio, pestaña 1 de 5')).toBeTruthy();
});
