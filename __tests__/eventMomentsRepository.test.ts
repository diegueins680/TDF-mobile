import {
  addMomentFeedComment,
  createMomentFeedItem,
  listMomentFeed,
  toggleMomentFeedReaction,
} from '../src/lib/eventMomentsRepository';

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
        reactions: { fire: [], love: [], applause: [] },
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
        reactions: { fire: [], love: [], applause: [] },
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
      reactions: { fire: [], love: [], applause: [] },
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

  it('keeps local temporary moments on the local path even when remote mode is preferred', async () => {
    mockLocalMoments.toggleMomentReaction.mockResolvedValue([]);

    await expect(
      toggleMomentFeedReaction(
        {
          eventId: '42',
          momentId: 'moment-local-3',
          actorKey: 'party:7',
          reaction: 'fire',
        },
        { preferRemote: true },
      ),
    ).resolves.toMatchObject({ source: 'local' });

    expect(mockEvents.reactToMoment).not.toHaveBeenCalled();
    expect(mockLocalMoments.toggleMomentReaction).toHaveBeenCalledTimes(1);
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
