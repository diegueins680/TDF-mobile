import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockReplace = jest.fn();
const mockSetOnboardingSeen: jest.Mock<Promise<void>, [boolean]> = jest.fn((_seen: boolean) =>
  Promise.resolve()
);

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MaterialCommunityIcons = ({ name }: { name?: string }) =>
    React.createElement(Text, null, name ?? 'icon');

  MaterialCommunityIcons.glyphMap = {
    'account-heart': 1,
    broadcast: 1,
    'ticket-confirmation': 1,
  };

  return { MaterialCommunityIcons };
});

jest.mock('../src/lib/onboarding', () => ({
  setOnboardingSeen: (seen: boolean) => mockSetOnboardingSeen(seen),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({
    locale: 'es',
    getCatalogItems: () => [
      { id: 'locale-es', code: 'es' },
      { id: 'locale-en', code: 'en' },
    ],
    setRegionalPreferences: jest.fn(),
  }),
}));

const OnboardingScreen = require('../app/onboarding').default;

describe('Onboarding screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows only the minimal new-user mobile surface', () => {
    render(<OnboardingScreen />);

    expect(screen.getByRole('header', { name: /Tu comunidad musical/i })).toBeTruthy();
    expect(screen.getByText(/Explora eventos, guarda tus favoritos y sigue artistas/i)).toBeTruthy();

    expect(screen.queryByText(/vCards|streaming|inventario|bookings|pipelines|parties/i)).toBeNull();
  });

  it('routes new and returning users through authentication', () => {
    render(<OnboardingScreen />);

    const createAccountButton = screen.getByText(/Crear cuenta/i).parent;
    if (!createAccountButton) throw new Error('Create account button not found');
    fireEvent.press(createAccountButton);
    expect(mockSetOnboardingSeen).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/auth', params: { mode: 'signup', intent: 'events' } });

    const loginButton = screen.getByText(/Ya tengo cuenta/i).parent;
    if (!loginButton) throw new Error('Login button not found');
    fireEvent.press(loginButton);
    expect(mockReplace).toHaveBeenCalledWith('/auth');
    expect(screen.queryByText(/Configurar perfil|Ver eventos/i)).toBeNull();
  });

  it('exposes named button controls with mobile-size touch targets', () => {
    render(<OnboardingScreen />);

    expect(StyleSheet.flatten(screen.getByRole('button', { name: /Crear cuenta/i }).props.style)).toMatchObject({ minHeight: 50 });
    expect(StyleSheet.flatten(screen.getByRole('button', { name: /Ya tengo cuenta/i }).props.style)).toMatchObject({ minHeight: 48 });
  });

  it('keeps enlarged content reachable instead of centering overflow above the scroll viewport', () => {
    render(<OnboardingScreen />);

    expect(StyleSheet.flatten(screen.getByTestId('onboardingScroll').props.contentContainerStyle)).toMatchObject({
      flexGrow: 1,
      paddingTop: 64,
    });
    expect(StyleSheet.flatten(screen.getByTestId('onboardingScroll').props.contentContainerStyle).justifyContent).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByTestId('onboardingPanel').props.style)).toMatchObject({
      width: '100%',
      marginVertical: 'auto',
    });
  });
});
