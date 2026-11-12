jest.mock('../src/api/client', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), del: jest.fn() }));
import { Events } from '../src/api/events';
import { get, post, put } from '../src/api/client';

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
  { ...publication, emId: {} }, { ...publication, emId: 'moment-local-fake' },
  { ...publication, emId: '0' }, { ...publication, emId: '-7' }, { ...publication, emEventId: '141' },
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


it.each([
  [{ inApp: false, supportsExtendedMoments: true }, true],
  [{ inApp: true, supportsExtendedMoments: false }, false],
  [{ inApp: 'true', supportsExtendedMoments: true }, false],
  [{ supportsExtendedMoments: true }, false],
  ['<html>Fallback</html>', false], [null, false], [[], false],
])('reads explicit server capability without opting into invitations %#', async (response, expected) => {
  jest.mocked(get).mockResolvedValue(response);
  await expect(Events.supportsExtendedMoments()).resolves.toBe(expected);
  expect(get).toHaveBeenCalledWith('/social-events/me/memory-invitations');
  expect(post).not.toHaveBeenCalled();
  expect(put).not.toHaveBeenCalled();
});

it('propagates a missing capability endpoint instead of enabling unsupported text', async () => {
  jest.mocked(get).mockRejectedValueOnce(new Error('404'));
  await expect(Events.supportsExtendedMoments()).rejects.toThrow('404');
});

it('publishes text with an empty media URL and accepts only the persisted response', async () => {
  const response = { ...publication, emMediaType: 'text', emMediaUrl: '', emCaption: 'El último coro' };
  jest.mocked(post).mockResolvedValue(response);
  await expect(Events.createMoment({ ...draft, caption: response.emCaption,
    media: { kind: 'text', uri: '', mimeType: 'text/plain' } })).resolves.toMatchObject({
      id: '77', caption: response.emCaption, media: { kind: 'text', uri: '', mimeType: 'text/plain' },
    });
  expect(post).toHaveBeenLastCalledWith('/social-events/events/42/moments', expect.objectContaining({
    emCreateMediaType: 'text', emCreateMediaUrl: '', emCreateCaption: response.emCaption,
  }));
});

it.each([
  { emCaption: '' }, { emCaption: '  ' }, { emCaption: 'x'.repeat(281) },
  { emMediaUrl: 'https://example.test/fake' }, { emEventId: '141' }, { emId: null },
])('rejects malformed or cross-event text acknowledgement %#', async (invalid) => {
  jest.mocked(post).mockResolvedValue({ ...publication, emMediaType: 'text', emMediaUrl: '', emCaption: 'Recuerdo', ...invalid });
  await expect(Events.createMoment({ ...draft, caption: 'Recuerdo', media: { kind: 'text', uri: '', mimeType: 'text/plain' } }))
    .rejects.toThrow('No se pudo confirmar');
});

it('reads audio and text through the extended feed without converting them to photos', async () => {
  jest.mocked(get).mockResolvedValueOnce([
    { ...publication, emMediaType: 'text', emMediaUrl: '', emCaption: 'Recuerdo' },
    { ...publication, emId: '78', emMediaType: 'audio', emMediaUrl: 'https://example.test/clip.m4a' },
  ]);
  await expect(Events.listMoments('42')).resolves.toMatchObject([
    { id: '77', media: { kind: 'text', uri: '', mimeType: 'text/plain' } },
    { id: '78', media: { kind: 'audio', mimeType: 'audio/mp4' } },
  ]);
  expect(get).toHaveBeenLastCalledWith('/social-events/events/42/moments?extended');
});

it.each([
  '<html>fallback</html>', [{ ...publication, emId: null }],
  [{ ...publication, emEventId: '141' }],
  [{ ...publication, emMediaType: 'audio', emMediaUrl: 'javascript:alert(1)' }],
])('does not display fabricated or unsafe feed entries %#', async (response) => {
  jest.mocked(get).mockResolvedValueOnce(response);
  await expect(Events.listMoments('42')).rejects.toThrow('No se pudo confirmar');
});


it('uploads an audio attachment through the existing durable media endpoint with its name and MIME', async () => {
  const append = jest.spyOn(FormData.prototype, 'append');
  try {
    jest.mocked(post).mockResolvedValueOnce({ eiuPublicUrl: 'https://assets.persona.test/recuerdo.wav' });
    await expect(Events.uploadMomentMedia('42', { kind: 'audio', uri: 'file:///cache/recuerdo.wav', fileName: 'recuerdo.wav', mimeType: 'audio/wav' }))
      .resolves.toBe('https://assets.persona.test/recuerdo.wav');
    expect(post).toHaveBeenLastCalledWith('/social-events/events/42/moments/media', expect.any(FormData), { headers: { 'Content-Type': 'multipart/form-data' } });
    expect(append).toHaveBeenCalledWith('file', expect.objectContaining({ uri: expect.stringContaining('recuerdo.wav'), name: 'recuerdo.wav', type: 'audio/wav' }));
  } finally { append.mockRestore(); }
});
