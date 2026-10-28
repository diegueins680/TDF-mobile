jest.mock('../src/api/client', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), del: jest.fn() }));
import { Events } from '../src/api/events';
import { post } from '../src/api/client';

const publication = { emId: '77', emEventId: '42', emMediaUrl: 'https://example.test/photo.jpg', emMediaType: 'image', emAuthorName: 'Server actor' };
const draft = { eventId: '42', authorName: 'Client actor', media: { kind: 'image' as const, uri: publication.emMediaUrl, mimeType: 'image/jpeg' } };
const reaction = { id: '50800000-0000-4000-8000-000000000001', code: 'fire', label: 'Fuego', nameEs: 'Fuego', nameEn: 'Fire', emoji: '🔥' };

beforeEach(() => jest.clearAllMocks());

it('omits absent optional fields from the actual moment JSON payload', async () => {
  jest.mocked(post).mockResolvedValue({ emId: '77', emMediaUrl: 'https://example.test/photo.jpg', emMediaType: 'image', emAuthorName: 'Server actor' });
  await Events.createMoment({ eventId: '42', authorName: 'Client display name', caption: null,
    media: { kind: 'image', uri: 'https://example.test/photo.jpg', mimeType: 'image/jpeg', width: null, height: null, durationMs: null } });
  const [path, body] = jest.mocked(post).mock.calls[0];
  expect(path).toBe('/social-events/events/42/moments');
  expect(JSON.parse(JSON.stringify(body))).toEqual({ emCreateMediaUrl: 'https://example.test/photo.jpg', emCreateMediaType: 'image' });
});

it('uploads event images through the existing event-scoped endpoint and videos through durable media', async () => {
  jest.mocked(post).mockResolvedValue({ eiuPublicUrl: 'https://assets.persona.test/memory.mp4' });
  await expect(Events.uploadMomentMedia('42', { kind: 'image', uri: 'file:///memory.jpg', mimeType: 'image/jpeg' })).resolves.toMatch(/^https:/);
  expect(post).toHaveBeenLastCalledWith('/social-events/events/42/moments/image', expect.any(FormData), { headers: { 'Content-Type': 'multipart/form-data' } });
  await Events.uploadMomentMedia('42', { kind: 'video', uri: 'file:///memory.mp4', mimeType: 'video/mp4' });
  expect(post).toHaveBeenLastCalledWith('/social-events/events/42/moments/media', expect.any(FormData), { headers: { 'Content-Type': 'multipart/form-data' } });
});

it.each([
  '<html>Fallback</html>', null, {}, [],
  { ...publication, emId: undefined }, { ...publication, emId: '' },
  { ...publication, emId: {} }, { ...publication, emEventId: '141' },
  { ...publication, emMediaUrl: '' }, { ...publication, emMediaType: 'unknown' },
  { ...publication, emAuthorName: undefined }, { ...publication, emCaption: {} },
])('does not invent a remote publication from an unconfirmed response %#', async (value) => {
  jest.mocked(post).mockResolvedValue(value);
  await expect(Events.createMoment(draft)).rejects.toThrow('No se pudo confirmar');
});

it('accepts the legacy publication response without an event ID', async () => {
  jest.mocked(post).mockResolvedValue({ ...publication, emEventId: undefined });
  await expect(Events.createMoment(draft)).resolves.toMatchObject({ id: '77', eventId: '42' });
});

it('does not acknowledge a reaction for another publication', async () => {
  jest.mocked(post).mockResolvedValue({ ...publication, emId: '88' });
  await expect(Events.reactToMoment('42', '77', reaction, true)).rejects.toThrow('No se pudo confirmar');
});

it('accepts the actual reaction state for the requested publication', async () => {
  jest.mocked(post).mockResolvedValue(publication);
  await expect(Events.reactToMoment('42', '77', reaction, true)).resolves.toMatchObject({ id: '77' });
});

it.each(['<html>Fallback</html>', null, {}, { emcId: '8', emcMomentId: '88', emcBody: 'Wrong source' }])('does not acknowledge a missing or cross-publication comment %#', async (value) => {
  jest.mocked(post).mockResolvedValue(value);
  await expect(Events.commentOnMoment({ eventId: '42', momentId: '77', authorName: 'Ana', body: 'My memory' })).rejects.toThrow('No se pudo confirmar');
});

it('accepts a persisted legacy comment without an optional parent ID', async () => {
  jest.mocked(post).mockResolvedValue({ emcId: '8', emcBody: 'My memory', emcAuthorName: 'Ana' });
  await expect(Events.commentOnMoment({ eventId: '42', momentId: '77', authorName: 'Ana', body: 'My memory' }))
    .resolves.toMatchObject({ id: '8', body: 'My memory' });
  expect(post).toHaveBeenLastCalledWith('/social-events/events/42/moments/77/comments', expect.objectContaining({ emccBody: 'My memory' }));
});
