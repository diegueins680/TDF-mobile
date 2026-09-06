import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockMutate = jest.fn();
const mockPush = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockUseQuery = jest.fn(({ queryKey }: { queryKey: unknown[] }) => {
  if (queryKey[0] === 'social-following') {
    return {
      data: [{
        pfFollowerId: 42,
        pfFollowingId: 7,
        pfFollowerName: 'Demo Fan',
        pfFollowingName: 'Fan Uno',
        pfStartedAt: '2026-06-18',
        pfViaNfc: false,
      }],
      isLoading: false,
      isError: false,
    };
  }

  if (queryKey[0] === 'social-followers') {
    return {
      data: [{
        pfFollowerId: 9,
        pfFollowingId: 42,
        pfFollowerName: 'Fan Dos',
        pfFollowingName: 'Demo Fan',
        pfStartedAt: '2026-06-18',
        pfViaNfc: false,
      }],
      isLoading: false,
      isError: false,
    };
  }

  if (queryKey[0] === 'onboarding') {
    return {
      data: [{ id: 'artist-1', partyId: '71', name: 'Artista Uno' }],
      isLoading: false,
      isError: false,
    };
  }

  return { data: [], isLoading: false, isError: false };
});

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(() => ({
    mutate: mockMutate,
    isPending: false,
    error: null,
  })),
  useQuery: (options: { queryKey: unknown[] }) => mockUseQuery(options),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({ token: 'Bearer demo', partyId: '42', loading: false })),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: jest.fn(() => ({ partyId: '42', displayName: 'Demo Fan', locale: 'es' })),
}));

const SocialScreen = require('../app/(tabs)/social').default;

describe('Social screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the visible social surface focused on following', () => {
    render(<SocialScreen />);

    expect(screen.getByRole('header', { name: 'Seguir' })).toBeTruthy();
    expect(screen.getByText(/Siguiendo \(1\)/i)).toBeTruthy();
    expect(screen.getByText(/Seguidores \(1\)/i)).toBeTruthy();
    expect(screen.getByText('Fan Uno')).toBeTruthy();
    expect(mockUseQuery).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['parties'] }),
    );

    expect(screen.queryByText(/Agregar amigo/i)).toBeNull();
    expect(screen.queryByText(/Sugerencias/i)).toBeNull();
    expect(screen.queryByText(/Amigos/i)).toBeNull();
    expect(screen.queryByText(/ID de contacto/i)).toBeNull();
  });

  it('offers a real artist follow action with an events fallback', () => {
    render(<SocialScreen />);

    expect(screen.getByRole('header', { name: 'Empieza siguiendo a un artista' })).toBeTruthy();
    expect(screen.getByText('Artista Uno')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Seguir a Artista Uno' }));
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ id: 'artist-1', name: 'Artista Uno' }));

    fireEvent.press(screen.getByRole('button', { name: 'Ver próximos eventos' }));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/events');
  });
});
