import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockMutate = jest.fn();
const mockPush = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockSetQueryData = jest.fn();
let mockFollows: Array<{ ffArtistId: number; ffArtistName: string }> = [];
const mockCapture = jest.fn();
type FirstValueCompletionArgs = [
  string | null | undefined,
  string,
  () => boolean,
  { capture: typeof mockCapture },
];
const mockRecordFirstValueCompletion = jest.fn<Promise<boolean>, FirstValueCompletionArgs>(async () => false);
const mockMutationOptions: Array<{
  mutationFn?: (variables: unknown) => Promise<unknown>;
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

  if (queryKey[0] === 'fan-artist-follows') return { data: mockFollows, isLoading: false, isError: false };

  if (queryKey[0] === 'onboarding') {
    return {
      data: [{ apArtistId: 71, apDisplayName: 'Artista Uno' }],
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
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries, setQueryData: mockSetQueryData })),
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
  recordFirstValueCompletion: (...args: FirstValueCompletionArgs) => mockRecordFirstValueCompletion(...args),
}));

jest.mock('../src/api/fanArtists', () => ({ FanArtists: { list: jest.fn(), listFollows: jest.fn(), follow: jest.fn() } }));

const SocialScreen = require('../app/(tabs)/social').default;

describe('Social screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutationOptions.length = 0;
    mockFollows = [];
    jest.requireMock('../src/providers/AuthProvider').useAuth.mockReturnValue({ token: 'Bearer demo', partyId: '42', session: { displayName: 'Demo Fan' }, loading: false });
  });

  it('keeps the visible social surface focused on following', () => {
    render(<SocialScreen />);

    expect(screen.getByRole('header', { name: 'Seguir' })).toBeTruthy();
    expect(screen.getByText(/Siguiendo \(1\)/i)).toBeTruthy();
    expect(screen.getByText(/Seguidores \(1\)/i)).toBeTruthy();
    expect(screen.getByText('Fan Uno')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Tu red de personas' })).toBeTruthy();
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
      artist: expect.objectContaining({ apArtistId: 71, apDisplayName: 'Artista Uno' }),
      ownerPartyId: '42',
    };
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining(variables));

    const artistFollowOptions = mockMutationOptions[1];
    await act(async () => {
      artistFollowOptions.onSuccess?.({ ffArtistId: 71, ffArtistName: 'Artista Uno' }, {
        artist: { apArtistId: 71, apDisplayName: 'Artista Uno' },
        ownerPartyId: '42', stillOwnsSession: () => true,
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

  it('renders the server follow after reopening and scopes the query to the current account', () => {
    mockFollows = [{ ffArtistId: 71, ffArtistName: 'Artista Uno' }];
    render(<SocialScreen />);
    expect(screen.getByRole('button', { name: 'Siguiendo a Artista Uno' }).props.accessibilityState.disabled).toBe(true);
    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['fan-artist-follows', '42'] }));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('uses the canonical artist Party ID and ignores a previous account response', async () => {
    const { FanArtists } = jest.requireMock('../src/api/fanArtists');
    render(<SocialScreen />);
    const options = mockMutationOptions[1];
    const artist = { apArtistId: 71, apDisplayName: 'Artista Uno' };
    await options.mutationFn?.({ artist, ownerPartyId: '42', stillOwnsSession: () => true });
    expect(FanArtists.follow).toHaveBeenCalledWith(71);
    await expect(options.mutationFn?.({ artist, ownerPartyId: '99', stillOwnsSession: () => true })).rejects.toThrow('sesión');
    options.onSuccess?.({ ffArtistId: 71, ffArtistName: 'Artista Uno' }, { artist, ownerPartyId: '99', stillOwnsSession: () => true });
    expect(mockSetQueryData).not.toHaveBeenCalled();
    expect(mockRecordFirstValueCompletion).not.toHaveBeenCalled();
  });

  it('rejects a pending follow after leaving and returning to the same account', async () => {
    const { useAuth } = jest.requireMock('../src/providers/AuthProvider');
    const view = render(<SocialScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Seguir a Artista Uno' }));
    const variables = mockMutate.mock.calls[0][0];
    const oldOptions = mockMutationOptions[1];
    useAuth.mockReturnValue({ token: 'Bearer other', partyId: '99', session: {}, loading: false });
    view.rerender(<SocialScreen />);
    useAuth.mockReturnValue({ token: 'Bearer renewed', partyId: '42', session: {}, loading: false });
    view.rerender(<SocialScreen />);
    const currentOptions = mockMutationOptions[mockMutationOptions.length - 2];
    await act(async () => {
      oldOptions.onSuccess?.({ ffArtistId: 71, ffArtistName: 'Artista Uno' }, variables);
      currentOptions.onSuccess?.({ ffArtistId: 71, ffArtistName: 'Artista Uno' }, variables);
    });
    expect(mockSetQueryData).not.toHaveBeenCalled();
    expect(mockRecordFirstValueCompletion).not.toHaveBeenCalled();
  });

});
