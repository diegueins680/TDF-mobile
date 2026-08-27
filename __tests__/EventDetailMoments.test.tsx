import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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
  useUserSettings: () => ({
    partyId: '7',
    displayName: 'Cuco',
    getCatalogItems: (code: string) => code === 'reaction-types' ? [{
      id: '50800000-0000-4000-8000-000000000001',
      code: 'fire',
      name: 'Fuego',
      nameEs: 'Fuego',
      nameEn: 'Fire',
      displaySymbol: '🔥',
    }] : [],
  }),
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

describe('EventDetail moments tab', () => {
  const useQuery = jest.mocked(require('@tanstack/react-query').useQuery as jest.Mock);
  const imagePicker = jest.mocked(require('expo-image-picker'));

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

      if (queryKey[0] === 'event-ticket-tiers') {
        return { data: [], isLoading: false };
      }

      if (queryKey[0] === 'event-ticket-orders') {
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
                '50800000-0000-4000-8000-000000000001': ['party:7'],
              },
              comments: [],
            },
          ],
          isLoading: false,
        };
      }

      if (queryKey[0] === 'event-live-broadcasts') {
        return {
          data: [
            {
              id: 'live-1',
              eventId: '42',
              artistId: '99',
              artistName: 'Demo Artist',
              broadcasterName: 'Cuco',
              broadcasterPartyId: '7',
              title: 'Front row',
              description: 'Coro final',
              status: 'live',
              playbackUrl: 'https://watch.example.com/live-1',
              whipUrl: 'https://stream.example.com/whip/live-1',
              streamKey: 'live-1',
              viewerCount: 3,
              startedAt: '2026-04-10T22:00:00.000Z',
              lastHeartbeatAt: '2026-04-10T22:00:00.000Z',
            },
          ],
          isLoading: false,
        };
      }

      if (queryKey[0] === 'event-live-followed-artists') {
        return { data: ['99'], isLoading: false };
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

    fireEvent.press(screen.getByLabelText('Ver foto de Andrea'));
    expect(screen.getByLabelText('Cerrar vista previa')).toBeTruthy();
    expect(screen.getByLabelText('Vista previa de la foto')).toBeTruthy();
  });

  it('adds several gallery photos with immediate thumbnails and one publish action', async () => {
    imagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///library/first.jpg',
          type: 'image',
          mimeType: 'image/jpeg',
          width: 2400,
          height: 1600,
          fileName: 'first.jpg',
        },
        {
          uri: 'file:///library/second.heic',
          type: 'image',
          mimeType: 'image/heic',
          width: 3024,
          height: 4032,
          fileName: 'second.heic',
        },
      ],
    });

    render(<EventDetailScreen />);
    fireEvent.press(screen.getByText('Momentos (1)'));
    fireEvent.press(screen.getByText('Compartir'));
    fireEvent.press(screen.getByText('Elegir fotos'));

    await waitFor(() => {
      expect(screen.getByText('2 archivos listos')).toBeTruthy();
      expect(screen.getByLabelText('Foto seleccionada 1')).toBeTruthy();
      expect(screen.getByLabelText('Foto seleccionada 2')).toBeTruthy();
    });

    expect(imagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: 6,
      mediaTypes: ['images'],
    }));

    fireEvent.press(screen.getByText('Publicar 2 momentos'));

    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
      caption: '',
      media: expect.arrayContaining([
        expect.objectContaining({ uri: 'file:///library/first.jpg' }),
        expect.objectContaining({ uri: 'file:///library/second.heic' }),
      ]),
      optimisticIds: expect.arrayContaining([
        expect.stringMatching(/^pending-moment-/),
        expect.stringMatching(/^pending-moment-/),
      ]),
    }));
    expect(screen.getByText('Momentos (3)')).toBeTruthy();
    expect(screen.getAllByText('Publicando…')).toHaveLength(2);
  });

  it('renders fanclub live broadcasts for followed event artists', () => {
    render(<EventDetailScreen />);

    fireEvent.press(screen.getByText('En Vivo (1)'));

    expect(screen.getByText('Fanclub en vivo')).toBeTruthy();
    expect(screen.getAllByText('Demo Artist').length).toBeGreaterThan(0);
    expect(screen.getByText('Front row')).toBeTruthy();
    expect(screen.getByText('En vivo')).toBeTruthy();
    expect(screen.getByText('Terminar')).toBeTruthy();
  });
});
