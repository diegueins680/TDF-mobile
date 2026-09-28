jest.mock('./client', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
import { get } from './client';
import { Interactions } from './interactions';

const mockGet = jest.mocked(get);
const identity = { kind: 'event' as const, entityKey: '42' };

test.each([undefined, null, '<!doctype html><html>SPA fallback</html>', {},
  { id: 'target', reactions: null },
  { id: 'target', reactions: [null], commentCount: 0, rootCount: 0 },
  { id: 'target', reactions: [], commentCount: -1, rootCount: 0 },
])('rejects malformed interaction summaries before rendering: %j', async (body) => {
  mockGet.mockResolvedValue(body);
  await expect(Interactions.summary(identity, true)).rejects.toThrow('Invalid interaction summary response');
});

test('a valid retry preserves the authoritative response', async () => {
  const summary = { id: 'target', reactions: [{ id: 'like', label: 'Like', emoji: '👍', count: 2 }], commentCount: 3, rootCount: 1 };
  mockGet.mockResolvedValueOnce('<html>unavailable</html>').mockResolvedValueOnce(summary);
  await expect(Interactions.summary(identity, false)).rejects.toThrow();
  await expect(Interactions.summary(identity, false)).resolves.toBe(summary);
});
