import { http } from './client';
import { fetchPublicWorkflowStates } from './catalogs';

jest.mock('./client', () => ({
  http: { get: jest.fn() },
  normalizeApiError: (error: unknown) => error,
}));

const getMock = jest.mocked(http.get);

describe('public workflow catalog API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses an encoded workflow path and conditional ETag request', async () => {
    getMock.mockResolvedValue({
      status: 304,
      data: null,
      headers: {},
    });

    await expect(fetchPublicWorkflowStates(' social/event ', 'es EC', '"workflow-7"')).resolves.toEqual({
      workflow: null,
      etag: '"workflow-7"',
      notModified: true,
    });
    expect(getMock).toHaveBeenCalledWith(
      '/catalogs/workflows/social%2Fevent/states?locale=es+EC',
      expect.objectContaining({ headers: { 'If-None-Match': '"workflow-7"' } }),
    );
  });
});
