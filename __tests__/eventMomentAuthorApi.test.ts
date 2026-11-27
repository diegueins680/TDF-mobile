import { del, get, put } from '../src/api/client';
import { Events } from '../src/api/events';
import type { EventMoment } from '../src/types';

jest.mock('../src/api/client', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), del: jest.fn() }));

const oldVersion = '2026-10-26T08:00:01.123456Z';
const newVersion = '2026-10-26T08:00:02.654321Z';
const moment: EventMoment = {
  id: '77', eventId: '42', authorPartyId: '7', authorName: 'Ana', caption: 'Original',
  media: { kind: 'image', uri: 'https://assets.persona.test/image.jpg', mimeType: 'image/jpeg' },
  createdAt: oldVersion, updatedAt: oldVersion, reactions: {}, comments: [],
};
const response = { emId: '77', emEventId: '42', emAuthorPartyId: '7', emAuthorName: 'Ana',
  emCaption: 'Actualizado', emMediaType: 'image', emMediaUrl: moment.media.uri,
  emCreatedAt: oldVersion, emUpdatedAt: newVersion };
beforeEach(() => jest.resetAllMocks());

it('preserves exact server version precision through feed, edit request and confirmed result', async () => {
  jest.mocked(get).mockResolvedValueOnce([{ ...response, emUpdatedAt: oldVersion }]);
  const [loaded] = await Events.listMoments('42');
  expect(loaded.updatedAt).toBe(oldVersion);
  jest.mocked(put).mockResolvedValueOnce(response);
  await expect(Events.editMoment(loaded, '  Actualizado  ')).resolves.toMatchObject({ id: '77', updatedAt: newVersion, caption: 'Actualizado' });
  expect(put).toHaveBeenCalledWith('/social-events/events/42/moments/77', {
    emeCaption: 'Actualizado', emeExpectedUpdatedAt: oldVersion,
  });
});

it.each([
  '<html>fallback</html>', null, {}, { ...response, emId: '88' },
  { ...response, emEventId: '141' }, { ...response, emAuthorPartyId: '8' },
  { ...response, emAuthorPartyId: undefined }, { ...response, emUpdatedAt: oldVersion },
  { ...response, emUpdatedAt: undefined }, { ...response, emUpdatedAt: 'not-a-version' },
  { ...response, emCaption: 'Another edit' },
])('does not acknowledge a malformed, stale or mismatched edit %#', async (value) => {
  jest.mocked(put).mockResolvedValueOnce(value);
  await expect(Events.editMoment(moment, 'Actualizado')).rejects.toThrow('No se pudo confirmar');
});

it.each([
  { id: 'moment-local-draft' }, { eventId: 'not-an-event' }, { updatedAt: undefined },
  { updatedAt: '2026' }, { authorPartyId: undefined },
])('does not dispatch unsupported or local draft edits %#', async (invalid) => {
  await expect(Events.editMoment({ ...moment, ...invalid }, 'Actualizado')).rejects.toThrow();
  expect(put).not.toHaveBeenCalled();
});

it('allows clearing a photo caption but rejects blank text memories and oversized edits', async () => {
  jest.mocked(put).mockResolvedValueOnce({ ...response, emCaption: null });
  await expect(Events.editMoment(moment, '')).resolves.toMatchObject({ caption: null });
  jest.mocked(put).mockClear();
  await expect(Events.editMoment({ ...moment, media: { kind: 'text', uri: '', mimeType: 'text/plain' } }, '  ')).rejects.toThrow();
  await expect(Events.editMoment(moment, 'x'.repeat(281))).rejects.toThrow();
  expect(put).not.toHaveBeenCalled();
});

it('requires the actual delete transport to accept only HTTP 204', async () => {
  jest.mocked(del).mockResolvedValueOnce('');
  await expect(Events.deleteMoment(moment)).resolves.toBeUndefined();
  expect(del).toHaveBeenCalledWith('/social-events/events/42/moments/77', expect.any(Object));
  const config = jest.mocked(del).mock.calls[0][1];
  expect(config?.validateStatus?.(204)).toBe(true);
  for (const status of [200, 202, 301, 401, 403, 404, 409, 500]) expect(config?.validateStatus?.(status)).toBe(false);
});

it.each(['<html>fallback</html>', { ok: true }])('does not acknowledge a nonempty delete response %#', async (value) => {
  jest.mocked(del).mockResolvedValueOnce(value);
  await expect(Events.deleteMoment(moment)).rejects.toThrow('No se pudo confirmar');
});

it('propagates server authorization and conflict errors without a local mutation fallback', async () => {
  const denied = new Error('Forbidden');
  jest.mocked(del).mockRejectedValueOnce(denied);
  jest.mocked(put).mockRejectedValueOnce(denied);
  await expect(Events.deleteMoment(moment)).rejects.toBe(denied);
  await expect(Events.editMoment(moment, 'Actualizado')).rejects.toBe(denied);
});
