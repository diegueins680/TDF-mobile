import React from 'react';
import { render, screen } from '@testing-library/react-native';

const mockMutate = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockUseQuery = jest.fn(({ queryKey }: { queryKey: unknown[] }) => {
  if (queryKey[0] === 'parties') {
    return {
      data: [
        { partyId: 7, displayName: 'Fan Uno' },
        { partyId: 9, displayName: 'Fan Dos' },
      ],
      isLoading: false,
      isError: false,
    };
  }

  if (queryKey[0] === 'social-following') {
    return {
      data: [{ pfFollowerId: 42, pfFollowingId: 7, pfStartedAt: '2026-06-18', pfViaNfc: false }],
      isLoading: false,
      isError: false,
    };
  }

  if (queryKey[0] === 'social-followers') {
    return {
      data: [{ pfFollowerId: 9, pfFollowingId: 42, pfStartedAt: '2026-06-18', pfViaNfc: false }],
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

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({ token: 'Bearer demo', partyId: '42', loading: false })),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: jest.fn(() => ({ partyId: '42', displayName: 'Demo Fan' })),
}));

const SocialScreen = require('../app/(tabs)/social').default;

describe('Social screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the visible social surface focused on following', () => {
    render(<SocialScreen />);

    expect(screen.getByText('Seguir')).toBeTruthy();
    expect(screen.getByText(/Siguiendo \(1\)/i)).toBeTruthy();
    expect(screen.getByText(/Seguidores \(1\)/i)).toBeTruthy();
    expect(screen.getByText('Fan Uno')).toBeTruthy();

    expect(screen.queryByText(/Agregar amigo/i)).toBeNull();
    expect(screen.queryByText(/Sugerencias/i)).toBeNull();
    expect(screen.queryByText(/Amigos/i)).toBeNull();
    expect(screen.queryByText(/ID de contacto/i)).toBeNull();
  });
});
