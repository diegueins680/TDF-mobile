import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import UserProfileScreen from '../app/userProfile';

const mockPush = jest.fn();
const mockMutate = jest.fn();
const mockFetchNextPage = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockSetStringAsync = jest.fn(async (_value: string) => undefined);
const mockCapture = jest.fn();

jest.mock('expo-clipboard', () => ({
  setStringAsync: (value: string) => mockSetStringAsync(value),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'upcoming-events') return { data: [], isLoading: false };
    if (queryKey[0] === 'saved-event-ids') return { data: [], isLoading: false };
    return { data: null, isLoading: false };
  }),
  useInfiniteQuery: jest.fn(() => ({
    data: {
      pages: [{
        items: [{
          type: 'event_rsvp',
          eventId: '42',
          status: 'GOING',
          title: 'Concierto público',
          startTime: '2030-04-10T20:00:00.000Z',
          timezone: 'America/Guayaquil',
          imageUrl: 'https://images.example.com/poster.jpg',
          venueName: 'Teatro Nacional',
          city: 'Quito',
          workflowStateCode: 'cancelled',
          actionAt: '2026-09-09T12:00:00.000Z',
          canonicalUrl: '/eventos/42',
          canEdit: true,
          canShare: true,
        }],
        nextCursor: 'cursor-2',
      }],
    },
    isLoading: false,
    isError: false,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: mockFetchNextPage,
    refetch: jest.fn(),
  })),
  useMutation: jest.fn(() => ({ mutate: mockMutate, isPending: false })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({ token: 'Bearer test-token', partyId: '7', session: { displayName: 'Andrea' } }),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({
    loading: false,
    localeId: 'es-EC',
    locale: 'es-EC',
    currencyId: 'USD',
    currency: 'USD',
    timezone: 'America/Guayaquil',
    countryId: null,
    countryCode: 'EC',
    getCatalogItems: () => [],
    setRegionalPreferences: jest.fn(),
  }),
}));

jest.mock('../src/theme/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: { actionPrimary: '#2563eb', textPrimary: '#111827' },
    preferenceId: 'system',
    options: [],
    catalogSource: 'catalog',
    setPreferenceById: jest.fn(),
  }),
}));

jest.mock('../src/analytics/AnalyticsProvider', () => ({
  useAnalytics: () => ({ capture: mockCapture }),
}));

jest.mock('../src/api/artists', () => ({ Artists: { getByParty: jest.fn() } }));
jest.mock('../src/api/events', () => ({
  Events: {
    list: jest.fn(),
    getById: jest.fn(),
    listRSVPFeed: jest.fn(),
    deleteRSVP: jest.fn(),
  },
}));
jest.mock('../src/lib/savedEvents', () => ({
  listSavedEventIds: jest.fn(),
  unsaveEvent: jest.fn(),
}));

describe('User profile RSVP activity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the typed feed and exposes safe open, copy, remove, and pagination actions', async () => {
    render(<UserProfileScreen />);

    fireEvent.press(screen.getByText('Actividad'));

    expect(await screen.findByText('Actividad de RSVP')).toBeTruthy();
    expect(screen.getByText('Va a')).toBeTruthy();
    expect(screen.getByText('Concierto público')).toBeTruthy();
    expect(screen.getByText('Teatro Nacional')).toBeTruthy();
    expect(screen.getByText('Cancelado')).toBeTruthy();

    fireEvent.press(screen.getByText('Abrir evento'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/eventDetail', params: { eventId: '42' } });

    fireEvent.press(screen.getByText('Copiar'));
    await waitFor(() => expect(mockSetStringAsync).toHaveBeenCalledTimes(1));
    const copiedUrl = String(mockSetStringAsync.mock.calls[0]?.[0]);
    expect(copiedUrl).toContain('/eventos/42');
    expect(copiedUrl).not.toMatch(/party|user|email|token/i);
    expect(mockCapture).toHaveBeenCalledWith('event_link_copied', expect.objectContaining({
      platform: 'mobile',
      event_id: '42',
      origin: 'profile_feed',
    }));

    fireEvent.press(screen.getByText('Eliminar RSVP'));
    expect(mockMutate).toHaveBeenCalledWith('42');

    fireEvent.press(screen.getByText('Cargar más'));
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
  });
});
