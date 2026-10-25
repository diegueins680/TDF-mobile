jest.mock('../src/api/client', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), del: jest.fn() }));
import { Events } from '../src/api/events';
import { post } from '../src/api/client';

it('omits absent optional fields from the actual moment JSON payload', async () => {
  jest.mocked(post).mockResolvedValue({ emId: '77', emMediaUrl: 'https://example.test/photo.jpg', emMediaType: 'image', emAuthorName: 'Server actor' });
  await Events.createMoment({ eventId: '42', authorName: 'Client display name', caption: null,
    media: { kind: 'image', uri: 'https://example.test/photo.jpg', mimeType: 'image/jpeg', width: null, height: null, durationMs: null } });
  const [path, body] = jest.mocked(post).mock.calls[0];
  expect(path).toBe('/social-events/events/42/moments');
  expect(JSON.parse(JSON.stringify(body))).toEqual({ emCreateMediaUrl: 'https://example.test/photo.jpg', emCreateMediaType: 'image' });
});
