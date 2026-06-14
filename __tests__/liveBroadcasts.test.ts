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
      artistId: 7,
      artistName: 'TDF Artist',
      broadcasterName: 'Cuco',
      broadcasterPartyId: '09',
      title: 'Front row',
      playbackUrl: 'https://stream.example.com/live/abc/index.m3u8',
      ingestUrl: 'rtmp://stream.example.com/live/abc',
      whipUrl: 'https://stream.example.com/whip/abc',
      streamKey: 'abc',
    });

    await expect(listEventLiveBroadcasts(42)).resolves.toMatchObject([
      {
        id: broadcast.id,
        eventId: '42',
        artistId: '7',
        artistName: 'TDF Artist',
        broadcasterPartyId: '9',
        status: 'live',
        playbackUrl: 'https://stream.example.com/live/abc/index.m3u8',
      },
    ]);

    await heartbeatEventLiveBroadcast({ eventId: 42, broadcastId: broadcast.id, viewerDelta: 3 });
    let stored = await listEventLiveBroadcasts('42');
    expect(stored[0]?.viewerCount).toBe(3);
    expect(countLiveBroadcasts(stored)).toBe(1);

    await endEventLiveBroadcast({ eventId: '42', broadcastId: broadcast.id, broadcasterPartyId: '9' });
    stored = await listEventLiveBroadcasts('42');
    expect(stored[0]).toMatchObject({
      id: broadcast.id,
      status: 'ended',
      viewerCount: 3,
    });
    expect(stored[0]?.endedAt).toBeTruthy();
    expect(countLiveBroadcasts(stored)).toBe(0);
  });

  it('sanitizes corrupted stored broadcasts on read', async () => {
    storage[STORAGE_KEY] = JSON.stringify({
      '0008': [
        {
          id: 'live-a',
          eventId: '0008',
          artistId: '0004',
          artistName: '  Artist Uno ',
          broadcasterName: '  Andrea ',
          broadcasterPartyId: ' 07 ',
          title: '  Desde el show ',
          description: '  Coro final ',
          status: 'live',
          playbackUrl: ' https://stream.example.com/a ',
          viewerCount: 2,
          startedAt: '2026-06-14T20:00:00.000Z',
          lastHeartbeatAt: '2026-06-14T20:01:00.000Z',
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
          startedAt: 'bad-date',
          lastHeartbeatAt: 'bad-date',
        },
      ],
    });

    await expect(listEventLiveBroadcasts('8')).resolves.toEqual([
      expect.objectContaining({
        eventId: '8',
        artistId: '4',
        artistName: 'Artist Uno',
        broadcasterName: 'Andrea',
        broadcasterPartyId: '7',
        title: 'Desde el show',
        description: 'Coro final',
        playbackUrl: 'https://stream.example.com/a',
      }),
    ]);
    expect(setItemMock).not.toHaveBeenCalled();
  });
});
