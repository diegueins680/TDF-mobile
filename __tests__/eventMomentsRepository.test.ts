import {
  addMomentFeedComment,
  createMomentFeedItem,
  isRemoteReactionActive,
  listMomentFeed,
  toggleMomentFeedReaction,
} from '../src/lib/eventMomentsRepository';
import { normalizeApiError } from '../src/api/client';

jest.mock('../src/api/events', () => ({
  Events: {
    listMoments: jest.fn(),
    createMoment: jest.fn(),
    reactToMoment: jest.fn(),
    commentOnMoment: jest.fn(),
  },
}));

jest.mock('../src/lib/eventMoments', () => ({
  listEventMoments: jest.fn(),
  createEventMoment: jest.fn(),
  toggleMomentReaction: jest.fn(),
  addMomentComment: jest.fn(),
}));

const mockEvents = jest.mocked(require('../src/api/events').Events);
const mockLocalMoments = jest.mocked(require('../src/lib/eventMoments'));

describe('event moments repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges remote moments with local drafts when remote is enabled', async () => {
    mockLocalMoments.listEventMoments.mockResolvedValue([
      {
        id: 'moment-local-1',
        eventId: '42',
        authorName: 'Local draft',
        media: { kind: 'image', uri: 'file:///local.jpg', mimeType: 'image/jpeg' },
        createdAt: '2026-04-10T20:00:00.000Z',
        reactions: { '50800000-0000-4000-8000-000000000001': [] },
        comments: [],
      },
    ]);
    mockEvents.listMoments.mockResolvedValue([
      {
        id: '77',
        eventId: '42',
        authorName: 'Remote sync',
        media: { kind: 'image', uri: 'https://example.com/remote.jpg', mimeType: 'image/jpeg' },
        createdAt: '2026-04-10T21:00:00.000Z',
        reactions: { '50800000-0000-4000-8000-000000000001': [] },
        comments: [],
      },
    ]);

    await expect(listMomentFeed('42', { preferRemote: true })).resolves.toMatchObject([
      { id: '77' },
      { id: 'moment-local-1' },
    ]);
  });

  it('falls back to local creation on transport or missing-endpoint failures', async () => {
    mockEvents.createMoment.mockRejectedValue({
      isAxiosError: true,
      message: 'Not Found',
      response: { status: 404 },
    });
    mockLocalMoments.createEventMoment.mockResolvedValue({
      id: 'moment-local-2',
      eventId: '42',
      authorName: 'Cuco',
      media: { kind: 'image', uri: 'file:///fallback.jpg', mimeType: 'image/jpeg' },
      createdAt: '2026-04-10T22:00:00.000Z',
      reactions: { '50800000-0000-4000-8000-000000000001': [] },
      comments: [],
    });

    await expect(
      createMomentFeedItem(
        {
          eventId: '42',
          authorName: 'Cuco',
          media: { kind: 'image', uri: 'file:///fallback.jpg', mimeType: 'image/jpeg' },
        },
        { preferRemote: true },
      ),
    ).resolves.toMatchObject({
      source: 'local',
      fallbackReason: 'Not Found',
      moment: { id: 'moment-local-2' },
    });
  });

  it('still falls back after the API client localizes an Axios transport error', async () => {
    const normalizedError = normalizeApiError({
      isAxiosError: true,
      message: 'Network Error',
      code: 'ERR_NETWORK',
      response: undefined,
    });
    mockEvents.createMoment.mockRejectedValue(normalizedError);
    mockLocalMoments.createEventMoment.mockResolvedValue({
      id: 'moment-local-network',
      eventId: '42',
      authorName: 'Cuco',
      media: { kind: 'image', uri: 'file:///network.jpg', mimeType: 'image/jpeg' },
      createdAt: '2026-04-10T22:00:00.000Z',
      reactions: { '50800000-0000-4000-8000-000000000001': [] },
      comments: [],
    });

    await expect(createMomentFeedItem({
      eventId: '42',
      authorName: 'Cuco',
      media: { kind: 'image', uri: 'file:///network.jpg', mimeType: 'image/jpeg' },
    }, { preferRemote: true })).resolves.toMatchObject({
      source: 'local',
      fallbackReason: expect.stringMatching(/internet/i),
    });

    expect((normalizedError as { code?: string }).code).toBe('ERR_NETWORK');
  });

  it('keeps local temporary moments on the local path even when remote mode is preferred', async () => {
    mockLocalMoments.toggleMomentReaction.mockResolvedValue([]);

    await expect(
      toggleMomentFeedReaction(
        {
          eventId: '42',
          momentId: 'moment-local-3',
          actorKey: 'party:7',
          reaction: {
            id: '50800000-0000-4000-8000-000000000001',
            code: 'fire',
            label: 'Fuego',
            nameEs: 'Fuego',
            nameEn: 'Fire',
            emoji: '🔥',
          },
          active: true,
        },
        { preferRemote: true },
      ),
    ).resolves.toMatchObject({ source: 'local' });

    expect(mockEvents.reactToMoment).not.toHaveBeenCalled();
    expect(mockLocalMoments.toggleMomentReaction).toHaveBeenCalledTimes(1);
    expect(mockLocalMoments.toggleMomentReaction).toHaveBeenCalledWith(
      expect.objectContaining({ reactionTypeId: '50800000-0000-4000-8000-000000000001' }),
      undefined,
    );
  });

  it('retains the acknowledged remote reaction state for activation decisions', async () => {
    const reaction = {
      id: '50800000-0000-4000-8000-000000000001',
      code: 'fire',
      label: 'Fuego',
      nameEs: 'Fuego',
      nameEn: 'Fire',
      emoji: '🔥',
    };
    mockEvents.reactToMoment.mockResolvedValue({
      id: '77',
      eventId: '42',
      authorName: 'Andrea',
      media: { kind: 'image', uri: 'https://example.com/moment.jpg', mimeType: 'image/jpeg' },
      createdAt: '2026-04-10T21:00:00.000Z',
      reactions: { [reaction.id]: ['party:7'] },
      comments: [],
    });

    const result = await toggleMomentFeedReaction({
      eventId: '42',
      momentId: '77',
      actorKey: 'party:7',
      reaction,
      active: true,
    }, { preferRemote: true });

    expect(result).toMatchObject({ source: 'remote', moment: { id: '77' } });
    expect(isRemoteReactionActive(result, reaction.id, 'party:7')).toBe(true);
    expect(isRemoteReactionActive(result, reaction.id, 'party:8')).toBe(false);
    expect(isRemoteReactionActive({ source: 'local' }, reaction.id, 'party:7')).toBe(false);
  });

  it('treats an acknowledged toggle-off response as removal, not activation', async () => {
    const reaction = {
      id: '50800000-0000-4000-8000-000000000001',
      code: 'fire',
      label: 'Fuego',
      nameEs: 'Fuego',
      nameEn: 'Fire',
      emoji: '🔥',
    };
    mockEvents.reactToMoment.mockResolvedValue({
      id: '77',
      eventId: '42',
      authorName: 'Andrea',
      media: { kind: 'image', uri: 'https://example.com/moment.jpg', mimeType: 'image/jpeg' },
      createdAt: '2026-04-10T21:00:00.000Z',
      reactions: {},
      comments: [],
    });

    const result = await toggleMomentFeedReaction({
      eventId: '42',
      momentId: '77',
      actorKey: 'party:7',
      reaction,
      active: false,
    }, { preferRemote: true });

    expect(isRemoteReactionActive(result, reaction.id, 'party:7')).toBe(false);
  });

  it('does not silently downgrade backend validation errors to local comments', async () => {
    mockEvents.commentOnMoment.mockRejectedValue({
      isAxiosError: true,
      message: 'Bad Request',
      response: { status: 400 },
    });

    await expect(
      addMomentFeedComment(
        {
          eventId: '42',
          momentId: '88',
          authorName: 'Cuco',
          body: 'Comentario',
        },
        { preferRemote: true },
      ),
    ).rejects.toMatchObject({
      message: 'Bad Request',
    });

    expect(mockLocalMoments.addMomentComment).not.toHaveBeenCalled();
  });
});
