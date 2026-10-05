import {
  endLiveBroadcastSession,
  heartbeatLiveBroadcastSession,
  listLiveBroadcastFeed,
  startLiveBroadcastSession,
} from '../src/lib/liveBroadcastsRepository';
import { normalizeApiError } from '../src/api/client';

jest.mock('../src/api/liveBroadcasts', () => ({
  LiveBroadcasts: {
    listByEvent: jest.fn(),
    start: jest.fn(),
    end: jest.fn(),
    heartbeat: jest.fn(),
  },
}));

jest.mock('../src/lib/liveBroadcasts', () => ({
  createEventLiveBroadcast: jest.fn(),
  endEventLiveBroadcast: jest.fn(),
  heartbeatEventLiveBroadcast: jest.fn(),
  listEventLiveBroadcasts: jest.fn(),
}));

const mockApi = jest.mocked(require('../src/api/liveBroadcasts').LiveBroadcasts);
const mockLocal = jest.mocked(require('../src/lib/liveBroadcasts'));

describe('live broadcasts repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocal.listEventLiveBroadcasts.mockResolvedValue([
      {
        id: 'live-local-1',
        eventId: '42',
        artistId: '7',
        artistName: 'Local Artist',
        broadcasterName: 'Local fan',
        broadcasterPartyId: '9',
        title: 'Local',
        status: 'live',
        viewerCount: 1,
        startedAt: '2026-04-10T20:00:00.000Z',
        lastHeartbeatAt: '2026-04-10T20:00:00.000Z',
      },
    ]);
  });

  it('merges remote broadcasts with local sessions when remote is enabled', async () => {
    mockApi.listByEvent.mockResolvedValue([
      {
        id: 'remote-1',
        eventId: '42',
        artistId: '8',
        artistName: 'Remote Artist',
        broadcasterName: 'Remote fan',
        broadcasterPartyId: '10',
        title: 'Remote',
        status: 'live',
        playbackUrl: 'https://watch.example.com/remote-1',
        viewerCount: 4,
        startedAt: '2026-04-10T21:00:00.000Z',
        lastHeartbeatAt: '2026-04-10T21:00:00.000Z',
      },
    ]);

    await expect(listLiveBroadcastFeed('42', { preferRemote: true })).resolves.toMatchObject([
      { id: 'remote-1' },
      { id: 'live-local-1' },
    ]);
  });

  it('falls back to local sessions when the remote endpoint is unavailable', async () => {
    mockApi.listByEvent.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
      message: 'not found',
    });

    await expect(listLiveBroadcastFeed('42', { preferRemote: true })).resolves.toMatchObject([
      { id: 'live-local-1' },
    ]);
  });

  it('still falls back after the API client localizes an Axios server error', async () => {
    const normalizedError = normalizeApiError({
      isAxiosError: true,
      message: 'Request failed',
      code: 'ERR_BAD_RESPONSE',
      response: { status: 503, data: 'Service unavailable' },
    });
    mockApi.listByEvent.mockRejectedValue(normalizedError);

    await expect(listLiveBroadcastFeed('42', { preferRemote: true })).resolves.toMatchObject([
      { id: 'live-local-1' },
    ]);

    expect((normalizedError as { response?: { status?: number } }).response?.status).toBe(503);
  });

  it('starts remote sessions before using local fallback', async () => {
    mockApi.start.mockResolvedValue({
      id: 'remote-2',
      eventId: '42',
      artistId: '7',
      artistName: 'Demo Artist',
      broadcasterName: 'Cuco',
      broadcasterPartyId: '9',
      title: 'Front row',
      status: 'live',
      whipUrl: 'https://stream.example.com/whip/remote-2',
      streamKey: 'remote-2',
      viewerCount: 1,
      startedAt: '2026-04-10T22:00:00.000Z',
      lastHeartbeatAt: '2026-04-10T22:00:00.000Z',
    });

    await expect(
      startLiveBroadcastSession(
        {
          eventId: '42',
          artistId: '7',
          artistName: 'Demo Artist',
          broadcasterName: 'Cuco',
          broadcasterPartyId: '9',
        },
        { preferRemote: true },
      ),
    ).resolves.toMatchObject({
      source: 'remote',
      broadcast: { id: 'remote-2', whipUrl: 'https://stream.example.com/whip/remote-2' },
    });

    expect(mockLocal.createEventLiveBroadcast).not.toHaveBeenCalled();
  });

  it.each([undefined, 401, 403, 404, 409, 500, 503])(
    'propagates remote mutation failure %s without claiming local acceptance',
    async (status) => {
      const error = normalizeApiError({
        isAxiosError: true,
        message: 'Synthetic remote failure',
        ...(status === undefined ? {} : { response: { status, data: 'Unavailable' } }),
      });
      mockApi.start.mockRejectedValueOnce(error);
      mockApi.end.mockRejectedValueOnce(error);
      mockApi.heartbeat.mockRejectedValueOnce(error);
      await expect(startLiveBroadcastSession({
        eventId: '42', artistId: '7', artistName: 'Demo', broadcasterName: 'Fan',
        broadcasterPartyId: '9',
      }, { preferRemote: true })).rejects.toBe(error);
      await expect(endLiveBroadcastSession({
        eventId: '42', broadcastId: 'remote-1', broadcasterPartyId: '9',
      }, { preferRemote: true })).rejects.toBe(error);
      await expect(heartbeatLiveBroadcastSession({
        eventId: '42', broadcastId: 'remote-1',
      }, { preferRemote: true })).rejects.toBe(error);
      expect(mockLocal.createEventLiveBroadcast).not.toHaveBeenCalled();
      expect(mockLocal.endEventLiveBroadcast).not.toHaveBeenCalled();
      expect(mockLocal.heartbeatEventLiveBroadcast).not.toHaveBeenCalled();
    },
  );

  it('keeps local broadcast endings on the local path', async () => {
    mockLocal.endEventLiveBroadcast.mockResolvedValue({
      id: 'live-local-1',
      eventId: '42',
      artistId: '7',
      artistName: 'Local Artist',
      broadcasterName: 'Cuco',
      broadcasterPartyId: '9',
      title: 'Local',
      status: 'ended',
      viewerCount: 1,
      startedAt: '2026-04-10T20:00:00.000Z',
      endedAt: '2026-04-10T20:30:00.000Z',
      lastHeartbeatAt: '2026-04-10T20:30:00.000Z',
    });

    await expect(
      endLiveBroadcastSession(
        { eventId: '42', broadcastId: 'live-local-1', broadcasterPartyId: '9' },
        { preferRemote: true },
      ),
    ).resolves.toEqual({ source: 'local' });

    expect(mockApi.end).not.toHaveBeenCalled();
    expect(mockLocal.endEventLiveBroadcast).toHaveBeenCalledWith({
      eventId: '42',
      broadcastId: 'live-local-1',
      broadcasterPartyId: '9',
    });
  });
});
