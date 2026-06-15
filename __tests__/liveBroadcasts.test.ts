import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  countLiveBroadcasts,
  createEventLiveBroadcast,
  endEventLiveBroadcast,
  heartbeatEventLiveBroadcast,
  listEventLiveBroadcasts,
} from '../src/lib/liveBroadcasts';

const STORAGE_KEY = 'tdf-event-live-broadcasts';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('live broadcast storage', () => {
  const getItemMock = jest.mocked(AsyncStorage.getItem);
  const setItemMock = jest.mocked(AsyncStorage.setItem);
  const removeItemMock = jest.mocked(AsyncStorage.removeItem);

  let storage: Record<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = {};

    getItemMock.mockImplementation(async (key: string) => storage[key] ?? null);
    setItemMock.mockImplementation(async (key: string, value: string) => {
      storage[key] = value;
    });
    removeItemMock.mockImplementation(async (key: string) => {
      delete storage[key];
    });
  });

  it('creates, heartbeats, and ends a fanclub live broadcast', async () => {
    const broadcast = await createEventLiveBroadcast({
      eventId: '0042',
      artistId: '0007',
      artistName: 'Demo Artist',
      broadcasterName: 'Cuco',
      broadcasterPartyId: '09',
      title: '  Front row  ',
      description: '  Coro final  ',
      whipUrl: 'https://stream.example.com/whip/live-1',
      streamKey: 'live-1',
    });

    await expect(listEventLiveBroadcasts(42)).resolves.toMatchObject([
      {
        id: broadcast.id,
        eventId: '42',
        artistId: '7',
        broadcasterPartyId: '9',
        title: 'Front row',
        status: 'live',
      },
    ]);

    await heartbeatEventLiveBroadcast({ eventId: 42, broadcastId: broadcast.id, viewerDelta: 3 });
    let stored = await listEventLiveBroadcasts('42');
    expect(stored[0]?.viewerCount).toBe(4);
    expect(countLiveBroadcasts(stored)).toBe(1);

    await endEventLiveBroadcast({ eventId: '42', broadcastId: broadcast.id, broadcasterPartyId: '9' });
    stored = await listEventLiveBroadcasts('42');
    expect(stored[0]).toMatchObject({
      id: broadcast.id,
      status: 'ended',
      viewerCount: 4,
    });
    expect(countLiveBroadcasts(stored)).toBe(0);
  });

  it('sanitizes corrupted stored broadcasts on read', async () => {
    storage[STORAGE_KEY] = JSON.stringify({
      '0008': [
        {
          id: 'live-a',
          eventId: '0008',
          artistId: '0003',
          artistName: '  Andrea  ',
          broadcasterName: '  Fan Uno ',
          broadcasterPartyId: ' 07 ',
          title: '  Intro ',
          description: '  ',
          status: 'live',
          playbackUrl: ' https://watch.example.com/live-a ',
          viewerCount: 2,
          startedAt: '2026-04-10T22:00:00.000Z',
          lastHeartbeatAt: '2026-04-10T22:00:10.000Z',
        },
        {
          id: '',
          eventId: '',
          artistId: '',
          artistName: '',
          broadcasterName: '',
          title: '',
          status: 'live',
          viewerCount: -1,
          startedAt: 'not-a-date',
          lastHeartbeatAt: '',
        },
      ],
    });

    await expect(listEventLiveBroadcasts('8')).resolves.toEqual([
      expect.objectContaining({
        eventId: '8',
        artistId: '3',
        artistName: 'Andrea',
        broadcasterName: 'Fan Uno',
        broadcasterPartyId: '7',
        description: null,
        playbackUrl: 'https://watch.example.com/live-a',
      }),
    ]);
    expect(setItemMock).not.toHaveBeenCalled();
  });
});
