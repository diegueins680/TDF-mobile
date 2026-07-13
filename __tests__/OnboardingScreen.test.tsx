import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

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

const OnboardingScreen = require('../app/onboarding').default;

describe('Onboarding screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows only the minimal new-user mobile surface', () => {
    render(<OnboardingScreen />);

    expect(screen.getByText(/Eventos y tickets/i)).toBeTruthy();
    expect(screen.getByText(/Perfil, seguir y vCards/i)).toBeTruthy();
    expect(screen.getByText(/Streaming y club de fans/i)).toBeTruthy();

    expect(screen.queryByText(/inventario|bookings|pipelines|parties/i)).toBeNull();
  });

  it('routes new and returning users through authentication', () => {
    render(<OnboardingScreen />);

    const createAccountButton = screen.getByText(/Crear cuenta/i).parent;
    if (!createAccountButton) throw new Error('Create account button not found');
    fireEvent.press(createAccountButton);
    expect(mockSetOnboardingSeen).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/auth', params: { mode: 'signup' } });

    const loginButton = screen.getByText(/Ya tengo cuenta/i).parent;
    if (!loginButton) throw new Error('Login button not found');
    fireEvent.press(loginButton);
    expect(mockReplace).toHaveBeenCalledWith('/auth');
    expect(screen.queryByText(/Configurar perfil|Ver eventos/i)).toBeNull();
  });
});
