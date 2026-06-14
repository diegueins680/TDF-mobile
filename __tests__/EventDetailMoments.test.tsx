import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import EventDetailScreen from '../app/eventDetail';

const mockMutate = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(() => ({ mutate: mockMutate, isPending: false })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ eventId: '42' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images', All: 'All' },
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn(async () => ({ granted: true })), jest.fn()],
  useMicrophonePermissions: () => [{ granted: true }, jest.fn(async () => ({ granted: true })), jest.fn()],
}));

jest.mock('@stripe/stripe-react-native', () => ({
  Constants: {
    API_VERSIONS: {
      CORE: '2026-04-22.dahlia',
      ISSUING: '2026-04-22.dahlia',
    },
  },
  initStripe: jest.fn(async () => undefined),
  usePaymentSheet: () => ({
    initPaymentSheet: jest.fn(async () => ({})),
    presentPaymentSheet: jest.fn(async () => ({})),
  }),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({ token: 'Bearer test-token', partyId: '7' }),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({ partyId: '7', displayName: 'Cuco' }),
}));

jest.mock('../src/api/events', () => ({
  Events: {
    getById: jest.fn(),
    getRSVPs: jest.fn(),
    getInvitations: jest.fn(),
    listTicketTiers: jest.fn(),
    listTicketOrders: jest.fn(),
    createTicketPaymentSheet: jest.fn(),
    rsvp: jest.fn(),
    sendInvitation: jest.fn(),
    respondToInvitation: jest.fn(),
  },
}));

jest.mock('../src/api/social', () => ({
  Social: {
    addFriend: jest.fn(),
  },
}));

jest.mock('../src/api/upload', () => ({
  uploadMedia: jest.fn(),
}));

describe('EventDetail moments tab', () => {
  const useQuery = jest.mocked(require('@tanstack/react-query').useQuery as jest.Mock);

  beforeEach(() => {
    jest.clearAllMocks();

    useQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'event') {
        return {
          data: {
            id: '42',
            title: 'TDF Showcase',
            startTime: '2026-04-10T20:00:00.000Z',
            endTime: '2026-04-11T01:00:00.000Z',
            venueId: '3',
            venue: {
              id: '3',
              name: 'Main Hall',
              address: 'Av. Siempre Viva',
              city: 'Quito',
              latitude: 0,
              longitude: 0,
              createdAt: '2026-04-01T00:00:00.000Z',
              updatedAt: '2026-04-01T00:00:00.000Z',
            },
            artistIds: ['2'],
            artists: [
              {
                id: '2',
                partyId: '20',
                name: 'TDF Artist',
                bio: null,
                imageUrl: null,
                genres: ['Rock'],
                instagramHandle: null,
                spotifyUrl: null,
                createdAt: '2026-04-01T00:00:00.000Z',
                updatedAt: '2026-04-01T00:00:00.000Z',
              },
            ],
            createdBy: '7',
            isPublic: true,
            rsvpCount: 2,
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
          isLoading: false,
          isError: false,
        };
      }

      if (queryKey[0] === 'event-rsvps') {
        return { data: [], isLoading: false };
      }

      if (queryKey[0] === 'event-invitations') {
        return { data: [], isLoading: false };
      }

      if (queryKey[0] === 'saved-event-ids') {
        return { data: [], isLoading: false };
      }

      if (queryKey[0] === 'event-moments') {
        return {
          data: [
            {
              id: 'moment-1',
              eventId: '42',
              authorName: 'Andrea',
              authorPartyId: '12',
              caption: 'Luces arriba',
              media: {
                kind: 'image',
                uri: 'https://example.com/moment.jpg',
                mimeType: 'image/jpeg',
              },
              createdAt: '2026-04-10T22:00:00.000Z',
              reactions: {
                fire: ['party:7'],
                love: [],
                applause: [],
              },
              comments: [],
            },
          ],
          isLoading: false,
        };
      }

      if (queryKey[0] === 'event-artist-followers') {
        return {
          data: {
            '2': [
              {
                artistId: '2',
                followerPartyId: '7',
                createdAt: '2026-04-10T20:00:00.000Z',
              },
            ],
          },
          isLoading: false,
        };
      }

      if (queryKey[0] === 'event-live-broadcasts') {
        return {
          data: [
            {
              id: 'live-1',
              eventId: '42',
              artistId: '2',
              artistName: 'TDF Artist',
              broadcasterName: 'Cuco',
              broadcasterPartyId: '7',
              title: 'Live desde front row',
              description: 'Coro final',
              status: 'live',
              playbackUrl: 'https://stream.example.com/live-1/index.m3u8',
              ingestUrl: 'rtmp://stream.example.com/live/live-1',
              whipUrl: 'https://stream.example.com/whip/live-1',
              streamKey: 'live-1',
              viewerCount: 12,
              startedAt: '2026-04-10T22:10:00.000Z',
              endedAt: null,
              lastHeartbeatAt: '2026-04-10T22:12:00.000Z',
            },
          ],
          isLoading: false,
        };
      }

      return { data: null, isLoading: false };
    });
  });

  it('renders the social feed when switching to Momentos', () => {
    render(<EventDetailScreen />);

    fireEvent.press(screen.getByText('Momentos (1)'));

    expect(screen.getByText('Momentos del evento')).toBeTruthy();
    expect(screen.getByText('Top Momentos')).toBeTruthy();
    expect(screen.getAllByText('Luces arriba').length).toBeGreaterThan(0);
    expect(screen.getByText('Top moment')).toBeTruthy();
    expect(screen.getByText('Conectar')).toBeTruthy();
    expect(screen.getByText('Publicas como Cuco')).toBeTruthy();
  });

  it('renders fanclub live broadcasts for followed event artists', () => {
    render(<EventDetailScreen />);

    fireEvent.press(screen.getByText('En Vivo (1)'));

    expect(screen.getByText('Transmisiones del fanclub')).toBeTruthy();
    expect(screen.getByText('Puedes transmitir para TDF Artist.')).toBeTruthy();
    expect(screen.getByText('Live desde front row')).toBeTruthy();
    expect(screen.getByText('Coro final')).toBeTruthy();
    expect(screen.getByText('Ver stream')).toBeTruthy();
    expect(screen.getByText('Cerrar vivo')).toBeTruthy();
  });
});
