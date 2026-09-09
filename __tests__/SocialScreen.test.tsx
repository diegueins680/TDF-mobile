import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockMutate = jest.fn();
const mockPush = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockCapture = jest.fn();
const mockRecordFirstValueCompletion = jest.fn(async () => false);
const mockMutationOptions: Array<{
  onSuccess?: (result: unknown, variables: unknown) => void;
}> = [];
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
  useMutation: jest.fn((options) => {
    mockMutationOptions.push(options);
    return {
    mutate: mockMutate,
    isPending: false,
    error: null,
    };
  }),
  useQuery: (options: { queryKey: unknown[] }) => mockUseQuery(options),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({
    token: 'Bearer demo',
    partyId: '42',
    session: { displayName: 'Demo Fan' },
    loading: false,
  })),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: jest.fn(() => ({ partyId: '42', displayName: 'Demo Fan', locale: 'es' })),
}));

jest.mock('../src/analytics/AnalyticsProvider', () => ({
  useAnalytics: () => ({ capture: mockCapture }),
}));

jest.mock('../src/lib/firstValueCompletion', () => ({
  recordFirstValueCompletion: (...args: unknown[]) => mockRecordFirstValueCompletion(...args),
}));

const SocialScreen = require('../app/(tabs)/social').default;

describe('Social screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutationOptions.length = 0;
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

  it('binds the real artist follow action to the initiating Party', async () => {
    render(<SocialScreen />);

    expect(screen.getByRole('header', { name: 'Empieza siguiendo a un artista' })).toBeTruthy();
    expect(screen.getByText('Artista Uno')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Seguir a Artista Uno' }));
    const variables = {
      artist: expect.objectContaining({ id: 'artist-1', name: 'Artista Uno' }),
      ownerPartyId: '42',
    };
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining(variables));

    const artistFollowOptions = mockMutationOptions[1];
    await act(async () => {
      artistFollowOptions.onSuccess?.(undefined, {
        artist: { id: 'artist-1', partyId: '71', name: 'Artista Uno' },
        ownerPartyId: '42',
      });
    });
    await waitFor(() => expect(mockRecordFirstValueCompletion).toHaveBeenCalledWith(
      '42',
      'artist_followed',
      expect.any(Function),
      expect.objectContaining({ capture: mockCapture }),
    ));
    const stillOwnsParty = mockRecordFirstValueCompletion.mock.calls[0][2] as () => boolean;
    expect(stillOwnsParty()).toBe(true);

    fireEvent.press(screen.getByRole('button', { name: 'Ver próximos eventos' }));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/events');
  });
});
