import { addMomentFeedComment, createMomentFeedItem, listMomentFeed, toggleMomentFeedReaction } from '../src/lib/eventMomentsRepository';
import { normalizeApiError } from '../src/api/client';
import { Events } from '../src/api/events';
import * as local from '../src/lib/eventMoments';

jest.mock('../src/api/events', () => ({ Events: { listMoments: jest.fn(), createMoment: jest.fn(), reactToMoment: jest.fn(), commentOnMoment: jest.fn() } }));
jest.mock('../src/lib/eventMoments', () => ({ listEventMoments: jest.fn(), createEventMoment: jest.fn(), toggleMomentReaction: jest.fn(), addMomentComment: jest.fn() }));
const remote = jest.mocked(Events); const drafts = jest.mocked(local);
const reaction = { id: '50800000-0000-4000-8000-000000000001', code: 'fire', label: 'Fuego', nameEs: 'Fuego', nameEn: 'Fire', emoji: '🔥' };
const input = { eventId: '42', momentId: '77', actorKey: 'party:9', reaction };
const draft = { eventId: '42', authorName: 'Ana', media: { kind: 'image' as const, uri: 'file:///draft.jpg', mimeType: 'image/jpeg' } };
const published = { ...draft, id: '77', createdAt: '2026-09-28T12:00:00Z', reactions: { [reaction.id]: ['party:9'] }, comments: [] };
beforeEach(() => jest.clearAllMocks());

test('published feeds contain only currently authorized remote records', async () => {
  drafts.listEventMoments.mockResolvedValue([{ ...published, id: 'moment-local-1' }]);
  remote.listMoments.mockResolvedValue([published]);
  expect(await listMomentFeed('42', { preferRemote: true })).toEqual([published]);
  expect(drafts.listEventMoments).not.toHaveBeenCalled();
});

test.each([undefined, 401, 403, 404, 409, 429, 500, 503])('does not convert remote error %s into shadow engagement', async (status) => {
  const error = normalizeApiError({ isAxiosError: true, message: 'Request failed', response: status ? { status } : undefined });
  remote.listMoments.mockRejectedValue(error); remote.createMoment.mockRejectedValue(error);
  remote.reactToMoment.mockRejectedValue(error); remote.commentOnMoment.mockRejectedValue(error);
  await expect(listMomentFeed('42', { preferRemote: true })).rejects.toBe(error);
  await expect(createMomentFeedItem(draft, { preferRemote: true })).rejects.toBe(error);
  await expect(toggleMomentFeedReaction(input, { preferRemote: true })).rejects.toBe(error);
  await expect(addMomentFeedComment({ eventId: '42', momentId: '77', authorName: 'Ana', body: 'Keep my draft' }, { preferRemote: true })).rejects.toBe(error);
  expect(drafts.createEventMoment).not.toHaveBeenCalled(); expect(drafts.toggleMomentReaction).not.toHaveBeenCalled(); expect(drafts.addMomentComment).not.toHaveBeenCalled();
});

test('retains explicitly local drafts without publishing them', async () => {
  const saved = { ...published, id: 'moment-local-1' }; drafts.createEventMoment.mockResolvedValue(saved);
  expect(await createMomentFeedItem(draft)).toEqual({ moment: saved, source: 'local' });
  expect(remote.createMoment).not.toHaveBeenCalled();
});

test('remote desired state still determines first-value evidence', async () => {
  remote.reactToMoment.mockResolvedValue(published);
  expect(await toggleMomentFeedReaction(input, { preferRemote: true })).toEqual({ source: 'remote', selected: true });
  remote.reactToMoment.mockResolvedValue({ ...published, reactions: { [reaction.id]: [] } });
  expect(await toggleMomentFeedReaction(input, { preferRemote: true })).toEqual({ source: 'remote', selected: false });
});

test('signed-out users cannot mutate a remote publication through local storage', async () => {
  await expect(toggleMomentFeedReaction(input)).rejects.toThrow('Inicia sesión');
  await expect(addMomentFeedComment({ eventId: '42', momentId: '77', authorName: 'Ana', body: 'No shadow comment' })).rejects.toThrow('Inicia sesión');
  expect(drafts.toggleMomentReaction).not.toHaveBeenCalled(); expect(drafts.addMomentComment).not.toHaveBeenCalled();
});
