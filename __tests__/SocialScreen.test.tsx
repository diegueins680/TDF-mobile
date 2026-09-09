import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockMutate = jest.fn();
const mockPush = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockCapture = jest.fn();
const mockMarkFirstValueCompleted = jest.fn();
const mockMutationOptions: Array<{
  onSuccess?: (data: unknown, variables: unknown) => unknown;
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

jest.mock('../src/analytics/AnalyticsProvider', () => ({
  useAnalytics: () => ({ capture: mockCapture }),
}));

jest.mock('../src/lib/onboardingIntent', () => ({
  markFirstValueCompleted: (...args: unknown[]) => mockMarkFirstValueCompleted(...args),
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

const SocialScreen = require('../app/(tabs)/social').default;

describe('Social screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutationOptions.length = 0;
    mockMarkFirstValueCompleted.mockResolvedValue('artist_followed');
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
    expect(mockMutate).toHaveBeenCalledWith({
      artist: expect.objectContaining({ id: 'artist-1', name: 'Artista Uno' }),
      ownerPartyId: '42',
      authToken: 'Bearer demo',
    });

    fireEvent.press(screen.getByRole('button', { name: 'Ver próximos eventos' }));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/events');
  });

  it('does not mislabel a person-to-person follow as artist activation', async () => {
    render(<SocialScreen />);

    await act(async () => {
      await mockMutationOptions[0]?.onSuccess?.(undefined, 9);
    });

    expect(mockCapture).not.toHaveBeenCalledWith('artist_followed', expect.anything());
    expect(mockMarkFirstValueCompleted).not.toHaveBeenCalled();
  });

  it('binds real artist activation to the current Party token', async () => {
    const artist = { id: 'artist-1', partyId: '71', name: 'Artista Uno' };
    render(<SocialScreen />);

    await act(async () => {
      await mockMutationOptions[1]?.onSuccess?.(undefined, {
        artist,
        ownerPartyId: '42',
        authToken: 'Bearer demo',
      });
    });

    expect(mockCapture).toHaveBeenCalledWith(
      'artist_followed',
      { platform: 'mobile', artist_id: 'artist-1' },
    );
    expect(mockMarkFirstValueCompleted).toHaveBeenCalledWith(
      '42',
      'artist_followed',
      'Bearer demo',
    );
    expect(mockCapture).toHaveBeenCalledWith(
      'first_value_completed',
      { platform: 'mobile', value: 'artist_followed' },
    );
  });

  it('suppresses artist success and completion after an auth-session replacement', async () => {
    const artist = { id: 'artist-1', partyId: '71', name: 'Artista Uno' };
    render(<SocialScreen />);

    await act(async () => {
      await mockMutationOptions[1]?.onSuccess?.(undefined, {
        artist,
        ownerPartyId: '41',
        authToken: 'Bearer previous',
      });
    });

    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockMarkFirstValueCompleted).not.toHaveBeenCalled();
  });
});
