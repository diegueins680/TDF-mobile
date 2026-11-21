import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import EventDetailScreen from '../app/eventDetail';
import { getDocumentAsync, type DocumentPickerResult } from 'expo-document-picker';
import { Alert } from 'react-native';
import type { EventMoment } from '../src/types';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

let mockExtendedMoments = false;
let mockMomentFeed: EventMoment[] | null = null;
const mockSetQueryData = jest.fn();
const mockMutate = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockCapture = jest.fn();
type FirstValueCompletionArgs = [
  string | null | undefined,
  string,
  () => boolean,
  { capture: typeof mockCapture },
];
const mockRecordFirstValueCompletion = jest.fn<Promise<boolean>, FirstValueCompletionArgs>(async () => false);
const mockRecordMomentReactionFirstValue = jest.fn<
  Promise<boolean>,
  [unknown, string | null, () => boolean, { capture: typeof mockCapture }]
>(async () => false);
const mockMutationOptions: Array<{
  mutationFn?: (variables: unknown) => Promise<unknown>;
  onSuccess?: (result: unknown, variables: unknown) => void;
}> = [];

function publicationScope() {
  const client = require('../src/api/client');
  const version = client.getAuthSessionVersion();
  return { eventId: '42', actor: { actorKey: 'party:7', partyId: '7', displayName: 'Cuco' },
    preferRemote: true, queryKey: ['event-moments', '42', 'party:7', 'remote'],
    stillOwns: () => client.getAuthSessionVersion() === version };
}

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
  useMutation: jest.fn((options) => {
    mockMutationOptions.push(options);
    return { mutate: mockMutate, isPending: false };
  }),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries, setQueryData: mockSetQueryData })),
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
  useAuth: () => ({ token: 'Bearer test-token', partyId: '7', session: { displayName: 'Cuco' } }),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({
    partyId: '7',
    displayName: 'Cuco',
    locale: 'es',
    timezone: 'UTC',
    currency: 'USD',
    showEventRsvpsOnProfile: true,
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
    supportsExtendedMoments: jest.fn(),
    createMoment: jest.fn(),
    editMoment: jest.fn(),
    deleteMoment: jest.fn(),
    uploadMomentMedia: jest.fn(),
    getPublicById: jest.fn(),
    getMyRSVP: jest.fn(),
    getRSVPSummary: jest.fn(),
    getRSVPs: jest.fn(),
    getInvitations: jest.fn(),
    listTicketTiers: jest.fn(),
    listTicketOrders: jest.fn(),
    createTicketPaymentSheet: jest.fn(),
    updateTicketOrderStatus: jest.fn(),
    rsvp: jest.fn(),
    deleteRSVP: jest.fn(),
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

jest.mock('../src/analytics/AnalyticsProvider', () => ({
  useAnalytics: () => ({ capture: mockCapture }),
}));

jest.mock('../src/lib/momentReactionFirstValue', () => ({
  recordMomentReactionFirstValue: (...args: Parameters<typeof mockRecordMomentReactionFirstValue>) =>
    mockRecordMomentReactionFirstValue(...args),
}));

jest.mock('../src/lib/firstValueCompletion', () => ({
  recordFirstValueCompletion: (...args: FirstValueCompletionArgs) => mockRecordFirstValueCompletion(...args),
}));

describe('EventDetail moments tab', () => {
  const useQuery = jest.mocked(require('@tanstack/react-query').useQuery as jest.Mock);
  const imagePicker = jest.mocked(require('expo-image-picker'));

  beforeEach(() => {
    mockExtendedMoments = false;
    mockMomentFeed = null;
    jest.mocked(getDocumentAsync).mockReset();
    const api = jest.mocked(require('../src/api/events').Events);
    api.uploadMomentMedia.mockReset();
    api.createMoment.mockReset();
    api.editMoment.mockReset();
    api.deleteMoment.mockReset();
    jest.clearAllMocks();
    mockMutationOptions.length = 0;
    mockSetQueryData.mockImplementation((_key, update) => {
      if (mockMomentFeed !== null) mockMomentFeed = typeof update === 'function' ? update(mockMomentFeed) : update;
    });

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
            publicListable: true,
            rsvpEligible: true,
            rsvpCount: 2,
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
          isLoading: false,
          isError: false,
        };
      }

      if (queryKey[0] === 'event-moment-capability') return { data: mockExtendedMoments };

      if (queryKey[0] === 'event-rsvps') {
        return { data: { status: 'INTERESTED', showOnProfile: false }, isLoading: false };
      }

      if (queryKey[0] === 'event-rsvp-summary') {
        return { data: { goingCount: 2, interestedCount: 1 }, isLoading: false };
      }

      if (queryKey[0] === 'event-invitations') {
        return { data: [], isLoading: false };
      }

      if (queryKey[0] === 'saved-event-ids') {
        return { data: { ids: [], source: 'server', pendingCount: 0 }, isLoading: false };
      }

      if (queryKey[0] === 'event-ticket-tiers') {
        return { data: [], isLoading: false };
      }

      if (queryKey[0] === 'event-ticket-orders') {
        return { data: [], isLoading: false };
      }

      if (queryKey[0] === 'event-moments' && mockMomentFeed !== null) return { data: mockMomentFeed, isLoading: false };

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

  it('publishes a written memory without a picker or an upload when the server supports it', async () => {
    mockExtendedMoments = true;
    render(<EventDetailScreen />);
    fireEvent.press(screen.getByText('Momentos (1)'));
    fireEvent.press(screen.getByText('Compartir'));
    fireEvent.changeText(screen.getByLabelText('Descripción del momento'), 'El último coro');
    fireEvent.press(screen.getByText('Publicar momento'));
    expect(mockMutate).toHaveBeenCalledTimes(1);
    const submission = mockMutate.mock.calls[0][0];
    expect(submission.media).toEqual([{ kind: 'text', uri: '', mimeType: 'text/plain' }]);
    const api = jest.mocked(require('../src/api/events').Events);
    api.createMoment.mockResolvedValueOnce({ id: '77', eventId: '42', caption: 'El último coro' });
    const result = await mockMutationOptions[5].mutationFn!(submission);
    expect(result).toEqual([expect.objectContaining({ status: 'fulfilled', source: 'remote' })]);
    expect(api.uploadMomentMedia).not.toHaveBeenCalled();
    expect(api.createMoment).toHaveBeenCalledWith(expect.objectContaining({ caption: 'El último coro' }));
  });

  it('keeps text publication disabled on older servers or for blank text', () => {
    render(<EventDetailScreen />);
    fireEvent.press(screen.getByText('Momentos (1)'));
    fireEvent.press(screen.getByText('Compartir'));
    fireEvent.changeText(screen.getByLabelText('Descripción del momento'), 'Recuerdo');
    fireEvent.press(screen.getByText('Publicar momento'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('restores failed text to the editor without adding a fake file or a local publication', async () => {
    mockExtendedMoments = true;
    const api = jest.mocked(require('../src/api/events').Events);
    api.createMoment.mockRejectedValueOnce(new Error('Network unavailable'));
    render(<EventDetailScreen />);
    fireEvent.press(screen.getByText('Momentos (1)'));
    fireEvent.press(screen.getByText('Compartir'));
    fireEvent.changeText(screen.getByLabelText('Descripción del momento'), 'Conservar este recuerdo');
    fireEvent.press(screen.getByText('Publicar momento'));
    const submission = mockMutate.mock.calls[0][0];
    const mutation = mockMutationOptions[5];
    const result = await mutation.mutationFn!(submission);
    act(() => mutation.onSuccess!(result, submission));
    expect(screen.getByDisplayValue('Conservar este recuerdo')).toBeTruthy();
    expect(screen.queryByText('1 archivo listo')).toBeNull();
    expect(screen.queryByText(/momento publicado/)).toBeNull();
    expect(api.uploadMomentMedia).not.toHaveBeenCalled();
    expect(require('@react-native-async-storage/async-storage').setItem).not.toHaveBeenCalled();
  });

  const audioAsset = { name: 'recuerdo.wav', uri: 'file:///cache/recuerdo.wav', mimeType: 'audio/wav', size: 200, lastModified: 0 };
  const openAudioComposer = () => {
    render(<EventDetailScreen />);
    fireEvent.press(screen.getByText('Momentos (1)'));
    fireEvent.press(screen.getByText('Compartir'));
  };

  it('keeps audio selection unavailable without an explicit compatible server', () => {
    openAudioComposer();
    expect(screen.queryByRole('button', { name: 'Agregar audio' })).toBeNull();
    expect(getDocumentAsync).not.toHaveBeenCalled();
  });

  it('does not offer public file uploads for a private event even when the server supports audio', () => {
    mockExtendedMoments = true;
    const original = useQuery.getMockImplementation()!;
    useQuery.mockImplementation((options) => {
      const result = original(options);
      return options.queryKey[0] === 'event' ? { ...result, data: { ...result.data, isPublic: false, publicListable: false } } : result;
    });
    openAudioComposer();
    expect(screen.queryByRole('button', { name: 'Agregar audio' })).toBeNull();
    expect(getDocumentAsync).not.toHaveBeenCalled();
  });

  it('selects cached audio and uploads it before asking for a persisted publication', async () => {
    mockExtendedMoments = true;
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [audioAsset] });
    const api = jest.mocked(require('../src/api/events').Events);
    api.uploadMomentMedia.mockResolvedValueOnce('https://assets.persona.test/recuerdo.wav');
    api.createMoment.mockResolvedValueOnce({ id: '77', eventId: '42', media: { kind: 'audio', uri: 'https://assets.persona.test/recuerdo.wav' } });
    openAudioComposer();
    fireEvent.press(screen.getByRole('button', { name: 'Agregar audio' }));
    await waitFor(() => expect(screen.getByText('recuerdo.wav')).toBeTruthy());
    expect(api.uploadMomentMedia).not.toHaveBeenCalled();
    expect(screen.getByText(/El archivo de audio tendrá un enlace público/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Descripción del momento'), 'El coro final');
    fireEvent.press(screen.getByText('Publicar audio público'));
    const submission = mockMutate.mock.calls[0][0];
    const result = await mockMutationOptions[5].mutationFn!(submission);
    expect(result).toEqual([expect.objectContaining({ status: 'fulfilled', source: 'remote' })]);
    expect(api.uploadMomentMedia).toHaveBeenCalledWith('42', expect.objectContaining({ kind: 'audio', uri: audioAsset.uri, fileName: audioAsset.name }));
    expect(api.createMoment).toHaveBeenCalledWith(expect.objectContaining({ caption: 'El coro final', media: expect.objectContaining({ kind: 'audio', uri: 'https://assets.persona.test/recuerdo.wav' }) }));
    expect(api.uploadMomentMedia.mock.invocationCallOrder[0]).toBeLessThan(api.createMoment.mock.invocationCallOrder[0]);
  });

  it('returns a failed audio upload to the editor without publishing a shadow copy', async () => {
    mockExtendedMoments = true;
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [audioAsset] });
    const api = jest.mocked(require('../src/api/events').Events);
    api.uploadMomentMedia.mockRejectedValueOnce(new Error('Network unavailable'));
    openAudioComposer();
    fireEvent.press(screen.getByRole('button', { name: 'Agregar audio' }));
    await waitFor(() => expect(screen.getByText('recuerdo.wav')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Descripción del momento'), 'Conservar audio');
    fireEvent.press(screen.getByText('Publicar audio público'));
    const submission = mockMutate.mock.calls[0][0];
    const mutation = mockMutationOptions[5];
    const result = await mutation.mutationFn!(submission);
    act(() => mutation.onSuccess!(result, submission));
    expect(screen.getByText('recuerdo.wav')).toBeTruthy();
    expect(screen.getByDisplayValue('Conservar audio')).toBeTruthy();
    expect(api.createMoment).not.toHaveBeenCalled();
    expect(require('@react-native-async-storage/async-storage').setItem).not.toHaveBeenCalled();
    expect(screen.queryByText(/momento publicado/)).toBeNull();
  });

  it('ignores cancellation and reports validation errors without clearing the caption', async () => {
    mockExtendedMoments = true;
    const alert = jest.spyOn(Alert, 'alert');
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: true, assets: null });
    openAudioComposer();
    fireEvent.changeText(screen.getByLabelText('Descripción del momento'), 'Mi recuerdo');
    fireEvent.press(screen.getByRole('button', { name: 'Agregar audio' }));
    await waitFor(() => expect(getDocumentAsync).toHaveBeenCalledTimes(1));
    expect(alert).not.toHaveBeenCalled();
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [{ ...audioAsset, size: 26 * 1024 * 1024 }] });
    fireEvent.press(screen.getByRole('button', { name: 'Agregar audio' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('No pudimos agregar el audio', expect.stringContaining('25 MB')));
    expect(screen.getByDisplayValue('Mi recuerdo')).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('discards a picker result after the editor is closed and reopened', async () => {
    mockExtendedMoments = true;
    let complete!: (result: DocumentPickerResult) => void;
    jest.mocked(getDocumentAsync).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    openAudioComposer();
    fireEvent.press(screen.getByRole('button', { name: 'Agregar audio' }));
    await waitFor(() => expect(getDocumentAsync).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByLabelText('Cerrar compositor de momento'));
    fireEvent.press(screen.getByText('Compartir'));
    await act(async () => complete({ canceled: false, assets: [audioAsset] }));
    expect(screen.queryByText('recuerdo.wav')).toBeNull();
    expect(screen.queryByText('1 archivo listo')).toBeNull();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('discards delayed audio selection after the authentication session changes', async () => {
    mockExtendedMoments = true;
    const client = require('../src/api/client');
    const previous = client.getAuthToken();
    client.setAuthToken('audio-first-account');
    let complete!: (result: DocumentPickerResult) => void;
    jest.mocked(getDocumentAsync).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    try {
      openAudioComposer();
      fireEvent.press(screen.getByRole('button', { name: 'Agregar audio' }));
      await waitFor(() => expect(getDocumentAsync).toHaveBeenCalledTimes(1));
      client.setAuthToken('audio-second-account');
      await act(async () => complete({ canceled: false, assets: [audioAsset] }));
      expect(screen.queryByText('recuerdo.wav')).toBeNull();
      expect(mockMutate).not.toHaveBeenCalled();
    } finally { client.setAuthToken(previous); }
  });

  const ownPublication: EventMoment = {
    id: '77', eventId: '42', authorName: 'Cuco', authorPartyId: '7', caption: 'Mi recuerdo original',
    media: { kind: 'text', uri: '', mimeType: 'text/plain' },
    createdAt: '2026-10-26T08:00:00.123456Z', updatedAt: '2026-10-26T08:00:00.123456Z',
    reactions: {}, comments: [],
  };
  const openOwnPublication = () => {
    mockExtendedMoments = true; mockMomentFeed = [{ ...ownPublication }];
    const view = render(<EventDetailScreen />);
    fireEvent.press(screen.getByText('Momentos (1)'));
    return view;
  };

  it('edits only after explicit confirmation and updates the feed from the acknowledged server record', async () => {
    const api = jest.mocked(require('../src/api/events').Events);
    const updated = { ...ownPublication, caption: 'Mi recuerdo corregido', updatedAt: '2026-10-26T08:01:00.654321Z' };
    api.editMoment.mockResolvedValueOnce(updated);
    openOwnPublication();
    fireEvent.press(screen.getByRole('button', { name: 'Editar recuerdo' }));
    fireEvent.changeText(screen.getByLabelText('Descripción del recuerdo'), updated.caption);
    expect(api.editMoment).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(screen.getByText('Recuerdo actualizado en TDF.')).toBeTruthy());
    expect(api.editMoment).toHaveBeenCalledWith(ownPublication, updated.caption);
    expect(mockSetQueryData).toHaveBeenCalledWith(['event-moments', '42', 'party:7', 'remote'], expect.any(Function));
    expect(mockMomentFeed).toEqual([updated]);
    expect(screen.queryByLabelText('Descripción del recuerdo')).toBeNull();
  });

  it('preserves an edited caption after a conflict instead of overwriting the newer server version', async () => {
    const api = jest.mocked(require('../src/api/events').Events);
    api.editMoment.mockRejectedValueOnce(Object.assign(new Error('Conflict'), { response: { status: 409 } }));
    openOwnPublication();
    fireEvent.press(screen.getByRole('button', { name: 'Editar recuerdo' }));
    fireEvent.changeText(screen.getByLabelText('Descripción del recuerdo'), 'Mi cambio sin confirmar');
    fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByDisplayValue('Mi cambio sin confirmar')).toBeTruthy();
    expect(screen.getByText(/El recuerdo cambió/)).toBeTruthy();
    expect(mockSetQueryData).not.toHaveBeenCalled();
    expect(mockMomentFeed).toEqual([ownPublication]);
    expect(screen.queryByText('Recuerdo actualizado en TDF.')).toBeNull();
  });

  it('does not dispatch a captured save action after a synchronous credential change', async () => {
    const client = require('../src/api/client'); const previous = client.getAuthToken();
    client.setAuthToken('author-first-account');
    try {
      openOwnPublication();
      fireEvent.press(screen.getByRole('button', { name: 'Editar recuerdo' }));
      fireEvent.changeText(screen.getByLabelText('Descripción del recuerdo'), 'Cambio retirado');
      const save = screen.getByRole('button', { name: 'Guardar cambios' });
      client.setAuthToken('author-second-account');
      fireEvent.press(save);
      expect(require('../src/api/events').Events.editMoment).not.toHaveBeenCalled();
      expect(mockSetQueryData).not.toHaveBeenCalled();
    } finally { client.setAuthToken(previous); }
  });

  it('ignores a late edit acknowledgement after credentials rotate', async () => {
    const client = require('../src/api/client'); const previous = client.getAuthToken();
    const api = jest.mocked(require('../src/api/events').Events);
    client.setAuthToken('author-first-account');
    api.editMoment.mockImplementationOnce(async () => {
      client.setAuthToken('author-replacement-account');
      return { ...ownPublication, caption: 'Respuesta tardía', updatedAt: '2026-10-26T08:01:00Z' };
    });
    try {
      openOwnPublication();
      fireEvent.press(screen.getByRole('button', { name: 'Editar recuerdo' }));
      fireEvent.changeText(screen.getByLabelText('Descripción del recuerdo'), 'Respuesta tardía');
      fireEvent.press(screen.getByRole('button', { name: 'Guardar cambios' }));
      await waitFor(() => expect(screen.queryByLabelText('Descripción del recuerdo')).toBeNull());
      expect(mockSetQueryData).not.toHaveBeenCalled();
      expect(screen.queryByText('Recuerdo actualizado en TDF.')).toBeNull();
    } finally { client.setAuthToken(previous); }
  });

  it('requires deletion confirmation, warns about public files, and removes only after acknowledgement', async () => {
    const api = jest.mocked(require('../src/api/events').Events);
    let complete!: () => void;
    api.deleteMoment.mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
    openOwnPublication();
    fireEvent.press(screen.getByRole('button', { name: 'Eliminar recuerdo' }));
    expect(screen.getByText(/archivos públicos y las copias externas/)).toBeTruthy();
    expect(api.deleteMoment).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Confirmar eliminación' });
    act(() => { fireEvent.press(confirm); fireEvent.press(confirm); });
    expect(api.deleteMoment).toHaveBeenCalledTimes(1);
    expect(mockMomentFeed).toEqual([ownPublication]);
    expect(mockSetQueryData).not.toHaveBeenCalled();
    await act(async () => complete());
    await waitFor(() => expect(screen.getByText('Publicación eliminada del evento.')).toBeTruthy());
    expect(mockMomentFeed).toEqual([]);
  });

  it('does not delete after cancellation or after the event screen retires', () => {
    const view = openOwnPublication();
    fireEvent.press(screen.getByRole('button', { name: 'Eliminar recuerdo' }));
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar eliminación' }));
    expect(require('../src/api/events').Events.deleteMoment).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Eliminar recuerdo' }));
    // Capture the rendered touch handler so retirement is checked even if an OS
    // event queued before unmount invokes it after the dialog has disappeared.
    let confirm = screen.getByRole('button', { name: 'Confirmar eliminación' });
    while (typeof confirm.props.onPress !== 'function' && confirm.parent) confirm = confirm.parent;
    const press = confirm.props.onPress;
    expect(press).toEqual(expect.any(Function));
    view.unmount();
    act(() => press());
    expect(require('../src/api/events').Events.deleteMoment).not.toHaveBeenCalled();
    expect(mockSetQueryData).not.toHaveBeenCalled();
  });

  it('retains the publication when deletion is not confirmed by the server', async () => {
    const api = jest.mocked(require('../src/api/events').Events);
    api.deleteMoment.mockRejectedValueOnce(new Error('Network unavailable'));
    openOwnPublication();
    fireEvent.press(screen.getByRole('button', { name: 'Eliminar recuerdo' }));
    fireEvent.press(screen.getByRole('button', { name: 'Confirmar eliminación' }));
    await waitFor(() => expect(screen.getByText('No pudimos confirmar la eliminación. Vuelve a cargar el evento antes de reintentar.')).toBeTruthy());
    expect(mockMomentFeed).toEqual([ownPublication]);
    expect(mockSetQueryData).not.toHaveBeenCalled();
    expect(screen.queryByText('Publicación eliminada del evento.')).toBeNull();
  });

  it('shows the authoritative RSVP selection, separate counts, and submits the chosen state', async () => {
    render(<EventDetailScreen />);

    await waitFor(() => expect(screen.getAllByRole('radio')[1]?.props.accessibilityState.selected).toBe(true));
    expect(screen.getByText('2 van · 1 interesadas')).toBeTruthy();
    expect(screen.getByLabelText('Mostrar este RSVP en mi perfil').props.value).toBe(false);

    fireEvent.press(screen.getByText('✓ Voy'));
    expect(mockMutate).toHaveBeenCalledWith({ status: 'GOING', profile: false });
  });

  it('renders the social feed when switching to Momentos', () => {
    render(<EventDetailScreen />);

    fireEvent.press(screen.getByText('Momentos (1)'));

    expect(screen.getByText('Momentos del evento')).toBeTruthy();
    expect(screen.getByText('Top Momentos')).toBeTruthy();
    expect(screen.getAllByText('Luces arriba').length).toBeGreaterThan(0);
    expect(screen.getByText('Momento destacado')).toBeTruthy();
    expect(screen.getByText('Conectar')).toBeTruthy();
    expect(screen.getByText('Publicas como Cuco')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Ver foto de Andrea'));
    expect(screen.getByLabelText('Cerrar vista previa')).toBeTruthy();
    expect(screen.getByLabelText('Vista previa de la foto')).toBeTruthy();
  });

  it('binds a successful reaction to the initiating Party first-value boundary', async () => {
    render(<EventDetailScreen />);
    fireEvent.press(screen.getByText('Momentos (1)'));
    fireEvent.press(screen.getByLabelText('Fuego: 1'));

    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
      momentId: 'moment-1',
      ownerPartyId: '7',
    }));

    const reactionOptions = mockMutationOptions[6];
    const result = { source: 'remote', selected: true };
    reactionOptions.onSuccess?.(result, { ownerPartyId: '7' });

    await waitFor(() => expect(mockRecordMomentReactionFirstValue).toHaveBeenCalledWith(
      result,
      '7',
      expect.any(Function),
      expect.objectContaining({ capture: mockCapture }),
    ));
    const stillOwnsParty = mockRecordMomentReactionFirstValue.mock.calls[0][2] as () => boolean;
    expect(stillOwnsParty()).toBe(true);
  });

  it('binds a successful event save to the initiating Party first-value boundary', async () => {
    render(<EventDetailScreen />);
    fireEvent.press(screen.getByText('Guardar evento'));

    expect(mockMutate).toHaveBeenCalledWith({
      targetEventId: '42',
      ownerPartyId: '7',
    });

    const saveOptions = mockMutationOptions[4];
    saveOptions.onSuccess?.(
      { saved: true, serverAcknowledged: true },
      { targetEventId: '42', ownerPartyId: '7' },
    );

    await waitFor(() => expect(mockRecordFirstValueCompletion).toHaveBeenCalledWith(
      '7',
      'event_saved',
      expect.any(Function),
      expect.objectContaining({ capture: mockCapture }),
    ));
    const stillOwnsParty = mockRecordFirstValueCompletion.mock.calls[0][2] as () => boolean;
    expect(stillOwnsParty()).toBe(true);
  });

  it('keeps a failed authenticated upload in the editor without creating a shadow publication', async () => {
    const api = jest.mocked(require('../src/api/events').Events);
    const storage = jest.mocked(require('@react-native-async-storage/async-storage'));
    api.uploadMomentMedia.mockRejectedValue(new Error('Network unavailable'));
    render(<EventDetailScreen />);
    const mutation = mockMutationOptions[5];
    const submission = { ...publicationScope(), caption: 'Keep this draft', media: [{ kind: 'video', uri: 'file:///clip.mp4', mimeType: 'video/mp4' }], optimisticIds: ['pending-1'] };
    const result = await mutation.mutationFn!(submission);
    expect(result).toEqual([{ index: 0, status: 'rejected', message: 'Network unavailable' }]);
    expect(api.createMoment).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    act(() => mutation.onSuccess!(result, submission));
    await waitFor(() => expect(screen.getByDisplayValue('Keep this draft')).toBeTruthy());
    expect(screen.queryByText(/momento publicado/)).toBeNull();
  });

  it('does not publish an uploaded draft under a different account', async () => {
    const client = require('../src/api/client');
    const previous = client.getAuthToken();
    const api = jest.mocked(require('../src/api/events').Events);
    client.setAuthToken('first-synthetic-account');
    api.uploadMomentMedia.mockImplementationOnce(async () => { client.setAuthToken('second-synthetic-account'); return 'https://assets.persona.test/video.mp4'; });
    try {
      render(<EventDetailScreen />);
      const result = await mockMutationOptions[5].mutationFn!({ ...publicationScope(), caption: 'First account draft', media: [{ kind: 'video', uri: 'file:///clip.mp4', mimeType: 'video/mp4' }], optimisticIds: ['pending-switch'] });
      expect(result).toEqual([expect.objectContaining({ status: 'rejected', message: expect.stringContaining('Tu sesión cambió') })]);
      expect(api.createMoment).not.toHaveBeenCalled();
    } finally { client.setAuthToken(previous); }
  });

  it('revokes the rendered publish action before the replacement session rerenders', async () => {
    const client = require('../src/api/client');
    const picker = require('expo-image-picker');
    const previous = client.getAuthToken();
    client.setAuthToken('first-synthetic-account');
    picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [
      { uri: 'file:///first-account.jpg', type: 'image', mimeType: 'image/jpeg', width: 20, height: 20 },
    ] });
    try {
      render(<EventDetailScreen />);
      fireEvent.press(screen.getByText('Momentos (1)'));
      fireEvent.press(screen.getByText('Compartir'));
      fireEvent.press(screen.getByText('Elegir fotos'));
      await waitFor(() => expect(screen.getByText('1 archivo listo')).toBeTruthy());
      const publish = screen.getByText('Publicar momento');
      client.setAuthToken('second-synthetic-account');
      fireEvent.press(publish);
      expect(mockMutate).not.toHaveBeenCalled();
    } finally { client.setAuthToken(previous); picker.launchImageLibraryAsync.mockReset(); }
  });

  it('does not let a late failure restore the retired caption over a new draft', async () => {
    const client = require('../src/api/client');
    const picker = require('expo-image-picker');
    const previous = client.getAuthToken();
    client.setAuthToken('first-synthetic-account');
    picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [
      { uri: 'file:///first-account.jpg', type: 'image', mimeType: 'image/jpeg', width: 20, height: 20 },
    ] });
    try {
      render(<EventDetailScreen />);
      fireEvent.press(screen.getByText('Momentos (1)'));
      fireEvent.press(screen.getByText('Compartir'));
      fireEvent.press(screen.getByText('Elegir fotos'));
      await waitFor(() => expect(screen.getByText('1 archivo listo')).toBeTruthy());
      fireEvent.changeText(screen.getByLabelText('Descripción del momento'), 'First account draft');
      const mutation = mockMutationOptions[5];
      fireEvent.press(screen.getByText('Publicar momento'));
      const submission = mockMutate.mock.calls[0][0];
      expect(submission.stillOwns()).toBe(true);
      client.setAuthToken('second-synthetic-account');
      fireEvent.press(screen.getByText('Compartir'));
      fireEvent.changeText(screen.getByLabelText('Descripción del momento'), 'New current draft');
      act(() => mutation.onSuccess!([{ index: 0, status: 'rejected', message: 'Late network error' }], submission));
      expect(screen.getByDisplayValue('New current draft')).toBeTruthy();
      expect(screen.queryByDisplayValue('First account draft')).toBeNull();
      client.setAuthToken('first-synthetic-account');
      expect(submission.stillOwns()).toBe(false);
    } finally { client.setAuthToken(previous); picker.launchImageLibraryAsync.mockReset(); }
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
