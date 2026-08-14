import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import EventDetailScreen from '../app/eventDetail';
import { renderWithTheme } from '../test/renderWithTheme';

const mockInvalidateQueries = jest.fn();
const mockStopPublisher = jest.fn();

const mockUseMutation = jest.fn((options) => ({
  mutate: (variables?: unknown) => {
    Promise.resolve()
      .then(() => options.mutationFn(variables))
      .then((data) => options.onSuccess?.(data, variables))
      .catch((error) => options.onError?.(error, variables));
  },
  isPending: false,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: (options: unknown) => mockUseMutation(options),
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

jest.mock('@stripe/stripe-react-native', () => ({
  Constants: { API_VERSIONS: { CORE: '2026-04-22.dahlia' } },
  initStripe: jest.fn(),
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
    updateTicketOrderStatus: jest.fn(),
    rsvp: jest.fn(),
    sendInvitation: jest.fn(),
    respondToInvitation: jest.fn(),
  },
}));

jest.mock('../src/api/artists', () => ({
  Artists: {
    listFollowers: jest.fn(),
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

jest.mock('../src/lib/liveBroadcastPublishing', () => ({
  RTCView: 'RTCView',
  startWhipBroadcastPublisher: jest.fn(),
}));

jest.mock('../src/lib/liveBroadcastsRepository', () => ({
  endLiveBroadcastSession: jest.fn(),
  heartbeatLiveBroadcastSession: jest.fn(),
  listLiveBroadcastFeed: jest.fn(),
  startLiveBroadcastSession: jest.fn(),
}));

const mockUseQuery = jest.mocked(require('@tanstack/react-query').useQuery as jest.Mock);
const mockStartPublisher = jest.mocked(
  require('../src/lib/liveBroadcastPublishing').startWhipBroadcastPublisher as jest.Mock,
);
const mockBroadcastsRepo = jest.mocked(require('../src/lib/liveBroadcastsRepository'));

const eventFixture = {
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
  artistIds: ['99'],
  artists: [
    {
      id: '99',
      partyId: '55',
      name: 'Demo Artist',
      genres: ['rock'],
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
  ],
  createdBy: '7',
  isPublic: true,
  rsvpCount: 2,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

const startedBroadcast = {
  id: 'remote-live-2',
  eventId: '42',
  artistId: '99',
  artistName: 'Demo Artist',
  broadcasterName: 'Cuco',
  broadcasterPartyId: '7',
  title: 'Front row',
  status: 'live',
  playbackUrl: 'https://watch.example.com/remote-live-2',
  whipUrl: 'https://stream.example.com/whip/remote-live-2',
  streamKey: 'remote-live-2',
  viewerCount: 1,
  startedAt: '2026-04-10T22:00:00.000Z',
  lastHeartbeatAt: '2026-04-10T22:00:00.000Z',
};

describe('EventDetail live broadcast lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStopPublisher.mockResolvedValue(undefined);
    mockStartPublisher.mockResolvedValue({ previewUrl: 'webrtc://local-preview', stop: mockStopPublisher });
    mockBroadcastsRepo.startLiveBroadcastSession.mockResolvedValue({
      source: 'remote',
      broadcast: startedBroadcast,
    });
    mockBroadcastsRepo.endLiveBroadcastSession.mockResolvedValue({ source: 'remote' });

    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'event') {
        return { data: eventFixture, isLoading: false, isError: false };
      }
      if (queryKey[0] === 'event-rsvps') return { data: [], isLoading: false };
      if (queryKey[0] === 'event-invitations') return { data: [], isLoading: false };
      if (queryKey[0] === 'saved-event-ids') return { data: [], isLoading: false };
      if (queryKey[0] === 'event-ticket-tiers') return { data: [], isLoading: false };
      if (queryKey[0] === 'event-ticket-orders') return { data: [], isLoading: false };
      if (queryKey[0] === 'event-moments') return { data: [], isLoading: false };
      if (queryKey[0] === 'event-live-broadcasts') return { data: [], isLoading: false };
      if (queryKey[0] === 'event-live-followed-artists') return { data: ['99'], isLoading: false };
      return { data: null, isLoading: false };
    });
  });

  it('ends the tracked backend broadcast when the broadcasting screen unmounts', async () => {
    const rendered = renderWithTheme(<EventDetailScreen />);

    fireEvent.press(screen.getByText('En Vivo (0)'));
    fireEvent.press(screen.getByText('Iniciar en vivo'));

    await waitFor(() => {
      expect(mockStartPublisher).toHaveBeenCalledWith({
        whipUrl: 'https://stream.example.com/whip/remote-live-2',
        streamKey: 'remote-live-2',
        quality: 'auto',
      });
    });

    rendered.unmount();

    await waitFor(() => {
      expect(mockStopPublisher).toHaveBeenCalledTimes(1);
      expect(mockBroadcastsRepo.endLiveBroadcastSession).toHaveBeenCalledWith(
        {
          eventId: '42',
          broadcastId: 'remote-live-2',
          broadcasterPartyId: '7',
        },
        { preferRemote: true },
      );
    });
  });
});
