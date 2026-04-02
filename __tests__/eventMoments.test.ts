import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  addMomentComment,
  buildMomentActor,
  countMomentReactions,
  createEventMoment,
  getMomentTopReaction,
  listEventMoments,
  listFeaturedMoments,
  scoreMoment,
  toggleMomentReaction,
} from '../src/lib/eventMoments';

const STORAGE_KEY = 'tdf-event-moments';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('event moments storage', () => {
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

  it('creates a moment and keeps the newest first', async () => {
    const first = await createEventMoment({
      eventId: '0012',
      authorName: 'Ana',
      media: {
        kind: 'image',
        uri: 'file:///first.jpg',
        mimeType: 'image/jpeg',
      },
    });

    const second = await createEventMoment({
      eventId: 12,
      authorName: 'Beto',
      media: {
        kind: 'video',
        uri: 'file:///second.mp4',
        mimeType: 'video/mp4',
        durationMs: 9000,
      },
    });

    await expect(listEventMoments('12')).resolves.toMatchObject([
      { id: second.id, eventId: '12', authorName: 'Beto' },
      { id: first.id, eventId: '12', authorName: 'Ana' },
    ]);
  });

  it('toggles one exclusive reaction per actor and supports comments', async () => {
    const actor = buildMomentActor({ partyId: '7', displayName: 'Cuco' });
    const moment = await createEventMoment({
      eventId: 9,
      authorName: 'Andrea',
      media: {
        kind: 'image',
        uri: 'file:///moment.jpg',
        mimeType: 'image/jpeg',
      },
    });

    await toggleMomentReaction({
      eventId: 9,
      momentId: moment.id,
      actorKey: actor.actorKey,
      reaction: 'fire',
    });

    let stored = await listEventMoments(9);
    expect(stored[0]?.reactions.fire).toEqual([actor.actorKey]);
    expect(countMomentReactions(stored[0]!)).toBe(1);
    expect(getMomentTopReaction(stored[0]!)).toBe('fire');

    await toggleMomentReaction({
      eventId: 9,
      momentId: moment.id,
      actorKey: actor.actorKey,
      reaction: 'love',
    });

    stored = await listEventMoments(9);
    expect(stored[0]?.reactions.fire).toEqual([]);
    expect(stored[0]?.reactions.love).toEqual([actor.actorKey]);

    await addMomentComment({
      eventId: 9,
      momentId: moment.id,
      authorName: actor.displayName,
      authorPartyId: actor.partyId,
      body: 'Suena durísimo',
    });

    stored = await listEventMoments(9);
    expect(stored[0]?.comments[0]).toMatchObject({
      authorName: 'Cuco',
      authorPartyId: '7',
      body: 'Suena durísimo',
    });
  });

  it('sanitizes corrupted storage payloads on read', async () => {
    storage[STORAGE_KEY] = JSON.stringify({
      '0012': [
        {
          id: 'moment-a',
          eventId: '0012',
          authorName: '  Lucia ',
          caption: '  Hola ',
          media: { kind: 'image', uri: 'file:///a.jpg', mimeType: 'image/jpeg' },
          createdAt: '2026-03-31T10:00:00.000Z',
          reactions: { fire: ['party:1', 'party:1'], love: [''], applause: ['party:2'] },
          comments: [
            {
              id: 'comment-a',
              authorName: 'Mario',
              body: 'Buenísimo',
              authorPartyId: ' 09 ',
              createdAt: '2026-03-31T10:30:00.000Z',
            },
            {
              id: '',
              authorName: '',
              body: '',
              createdAt: 'not-a-date',
            },
          ],
        },
        {
          id: 'broken',
          eventId: '',
          authorName: '',
          media: { kind: 'image', uri: '', mimeType: '' },
          createdAt: 'not-a-date',
          reactions: {},
        },
      ],
    });

    await expect(listEventMoments('12')).resolves.toEqual([
      expect.objectContaining({
        eventId: '12',
        authorName: 'Lucia',
        caption: 'Hola',
        reactions: {
          fire: ['party:1'],
          love: [],
          applause: ['party:2'],
        },
        comments: [
          expect.objectContaining({
            authorPartyId: '9',
          }),
        ],
      }),
    ]);
    expect(setItemMock).not.toHaveBeenCalled();
  });

  it('scores featured moments using recency and engagement', async () => {
    const featured = await createEventMoment({
      eventId: '77',
      authorName: 'Featured',
      media: {
        kind: 'image',
        uri: 'file:///featured.jpg',
        mimeType: 'image/jpeg',
      },
    });
    const fresh = await createEventMoment({
      eventId: '77',
      authorName: 'Fresh',
      media: {
        kind: 'image',
        uri: 'file:///fresh.jpg',
        mimeType: 'image/jpeg',
      },
    });

    await toggleMomentReaction({ eventId: '77', momentId: featured.id, actorKey: 'party:1', reaction: 'fire' });
    await toggleMomentReaction({ eventId: '77', momentId: featured.id, actorKey: 'party:2', reaction: 'fire' });
    await addMomentComment({
      eventId: '77',
      momentId: featured.id,
      authorName: 'Lia',
      body: 'Qué buen momento',
    });

    const stored = await listEventMoments('77');
    const ranked = listFeaturedMoments(stored, 1);
    expect(ranked[0]?.id).toBe(featured.id);
    expect(scoreMoment(ranked[0]!)).toBeGreaterThan(scoreMoment(stored.find((moment) => moment.id === fresh.id)!));
  });
});
