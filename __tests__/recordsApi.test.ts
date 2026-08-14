const mockGet = jest.fn();
const mockNormalizeApiError = jest.fn((error: unknown) => error);

jest.mock('../src/api/client', () => ({
  http: { get: (...args: unknown[]) => mockGet(...args) },
  normalizeApiError: (error: unknown) => mockNormalizeApiError(error),
}));

import { fetchRecordsFeed } from '../src/api/records';

describe('Records API client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the generated feed contract and sends conditional revision tokens', async () => {
    mockGet.mockResolvedValue({ status: 304, data: null, headers: { etag: '"catalog-9"' } });

    await expect(fetchRecordsFeed('es EC', '"catalog-9"')).resolves.toEqual({
      feed: null,
      etag: '"catalog-9"',
      notModified: true,
    });

    expect(mockGet).toHaveBeenCalledWith('/records/feed?locale=es+EC', expect.objectContaining({
      headers: { 'If-None-Match': '"catalog-9"' },
      validateStatus: expect.any(Function),
    }));
    const validateStatus = mockGet.mock.calls[0]?.[1]?.validateStatus as (status: number) => boolean;
    expect(validateStatus(304)).toBe(true);
    expect(validateStatus(409)).toBe(false);
  });

  it('returns a typed 200 feed and normalizes transport failures', async () => {
    const feed = { locale: 'es', revision: 9, collections: [], releases: [], recordings: [], sessions: [] };
    mockGet.mockResolvedValueOnce({ status: 200, data: feed, headers: {} });
    await expect(fetchRecordsFeed('es')).resolves.toEqual({ feed, etag: null, notModified: false });

    const failure = new Error('offline');
    mockGet.mockRejectedValueOnce(failure);
    await expect(fetchRecordsFeed('es')).rejects.toBe(failure);
    expect(mockNormalizeApiError).toHaveBeenCalledWith(failure);
  });
});
