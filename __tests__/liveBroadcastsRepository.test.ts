import {
  createLiveBroadcastFeedItem,
  endLiveBroadcastFeedItem,
  listLiveBroadcastFeed,
} from '../src/lib/liveBroadcastsRepository';

jest.mock('../src/api/liveBroadcasts', () => ({
  LiveBroadcasts: {
    listByEvent: jest.fn(),
    start: jest.fn(),
    end: jest.fn(),
    heartbeat: jest.fn(),
    provisionTransmission: jest.fn(),
  },
}));

jest.mock('../src/lib/liveBroadcasts', () => ({
  listEventLiveBroadcasts: jest.fn(),
  createEventLiveBroadcast: jest.fn(),
  endEventLiveBroadcast: jest.fn(),
  heartbeatEventLiveBroadcast: jest.fn(),
}));

const mockApi = jest.mocked(require('../src/api/liveBroadcasts').LiveBroadcasts);
const mockLocal = jest.mocked(require('../src/lib/liveBroadcasts'));

describe('live broadcasts repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges remote broadcasts with local sessions when remote is enabled', async () => {
    mockLocal.listEventLiveBroadcasts.mockResolvedValue([
      {
        id: 'live-local-1',
        eventId: '42',
        artistId: '7',
        artistName: 'Local Artist',
        broadcasterName: 'Local fan',
        broadcasterPartyId: '9',
        title: 'Local vivo',
        status: 'live',
        playbackUrl: 'tdf://events/42/live/local',
        viewerCount: 0,
        startedAt: '2026-06-14T20:00:00.000Z',
        endedAt: null,
        lastHeartbeatAt: '2026-06-14T20:00:00.000Z',
      },
    ]);
    mockApi.listByEvent.mockResolvedValue([
      {
        id: 'remote-1',
        eventId: '42',
        artistId: '7',
        artistName: 'Remote Artist',
        broadcasterName: 'Remote fan',
        broadcasterPartyId: '10',
        title: 'Remote vivo',
        status: 'live',
        playbackUrl: 'https://stream.example.com/remote/index.m3u8',
        viewerCount: 5,
        startedAt: '2026-06-14T20:05:00.000Z',
        endedAt: null,
        lastHeartbeatAt: '2026-06-14T20:05:10.000Z',
      },
    ]);

    await expect(listLiveBroadcastFeed('42', { preferRemote: true })).resolves.toMatchObject([
      { id: 'remote-1' },
      { id: 'live-local-1' },
    ]);
  });

  it('provisions radio stream URLs before creating a local fallback session', async () => {
    mockApi.start.mockRejectedValue({
      isAxiosError: true,
      message: 'Not Found',
      response: { status: 404 },
    });
    mockApi.provisionTransmission.mockResolvedValue({
      playbackUrl: 'https://stream.example.com/hls/fan/index.m3u8',
      ingestUrl: 'rtmp://stream.example.com/live/fan',
      whipUrl: 'https://stream.example.com/whip/fan',
      streamKey: 'fan',
    });
    mockLocal.createEventLiveBroadcast.mockResolvedValue({
      id: 'live-local-2',
      eventId: '42',
      artistId: '7',
      artistName: 'TDF Artist',
      broadcasterName: 'Cuco',
      broadcasterPartyId: '9',
      title: 'TDF Artist en vivo',
      status: 'live',
      playbackUrl: 'https://stream.example.com/hls/fan/index.m3u8',
      ingestUrl: 'rtmp://stream.example.com/live/fan',
      whipUrl: 'https://stream.example.com/whip/fan',
      streamKey: 'fan',
      viewerCount: 0,
      startedAt: '2026-06-14T20:00:00.000Z',
      endedAt: null,
      lastHeartbeatAt: '2026-06-14T20:00:00.000Z',
    });

    await expect(
      createLiveBroadcastFeedItem(
        {
          eventId: '42',
          artistId: '7',
          artistName: 'TDF Artist',
          broadcasterName: 'Cuco',
          broadcasterPartyId: '9',
        },
        { preferRemote: true },
      ),
    ).resolves.toMatchObject({
      source: 'local',
      fallbackReason: 'Not Found',
      transmissionProvisioned: true,
      broadcast: { id: 'live-local-2' },
    });

    expect(mockLocal.createEventLiveBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        playbackUrl: 'https://stream.example.com/hls/fan/index.m3u8',
        ingestUrl: 'rtmp://stream.example.com/live/fan',
        whipUrl: 'https://stream.example.com/whip/fan',
        streamKey: 'fan',
      }),
    );
  });

  it('does not downgrade backend validation errors', async () => {
    mockApi.start.mockRejectedValue({
      isAxiosError: true,
      message: 'Bad Request',
      response: { status: 400 },
    });

    await expect(
      createLiveBroadcastFeedItem(
        {
          eventId: '42',
          artistId: '7',
          artistName: 'TDF Artist',
          broadcasterName: 'Cuco',
          broadcasterPartyId: '9',
        },
        { preferRemote: true },
      ),
    ).rejects.toMatchObject({ message: 'Bad Request' });

    expect(mockLocal.createEventLiveBroadcast).not.toHaveBeenCalled();
  });

  it('keeps local broadcast endings on the local path', async () => {
    mockLocal.endEventLiveBroadcast.mockResolvedValue({
      id: 'live-local-3',
      eventId: '42',
      artistId: '7',
      artistName: 'TDF Artist',
      broadcasterName: 'Cuco',
      broadcasterPartyId: '9',
      title: 'Local vivo',
      status: 'ended',
      playbackUrl: 'tdf://events/42/live/live-local-3',
      viewerCount: 0,
      startedAt: '2026-06-14T20:00:00.000Z',
      endedAt: '2026-06-14T20:10:00.000Z',
      lastHeartbeatAt: '2026-06-14T20:10:00.000Z',
    });

    await expect(
      endLiveBroadcastFeedItem(
        {
          eventId: '42',
          broadcastId: 'live-local-3',
          broadcasterPartyId: '9',
        },
        { preferRemote: true },
      ),
    ).resolves.toMatchObject({ source: 'local' });

    expect(mockApi.end).not.toHaveBeenCalled();
    expect(mockLocal.endEventLiveBroadcast).toHaveBeenCalledTimes(1);
  });
});
