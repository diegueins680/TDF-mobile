jest.mock('../src/api/client', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), del: jest.fn() }));
import { Events } from '../src/api/events';
import { post } from '../src/api/client';

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
