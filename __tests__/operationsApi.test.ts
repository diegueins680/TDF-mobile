jest.mock('../src/api/client', () => ({
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
}));

import { get, patch } from '../src/api/client';
import {
  listOperationsWorkItems,
  transitionOperationsWorkItem,
} from '../src/api/operations';

describe('mobile operations API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses bounded server-side filters and cursor pagination', async () => {
    jest.mocked(get).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    await listOperationsWorkItems({ search: 'transferencia', status: 'waiting', limit: 40 });
    expect(get).toHaveBeenCalledWith(
      '/operations/work-items?limit=40&q=transferencia&status=waiting',
    );
  });

  it('sends a versioned work transition without issuing a source-entity command', async () => {
    jest.mocked(patch).mockResolvedValue({ id: 'work-1' } as never);
    await transitionOperationsWorkItem('work-1', {
      expectedVersion: 7,
      targetStatus: 'resolved',
      reason: 'Investigated; source state remains unchanged',
    });
    expect(patch).toHaveBeenCalledWith(
      '/operations/work-items/work-1/transition',
      expect.objectContaining({
        expectedVersion: 7,
        targetStatus: 'resolved',
        sourceClient: 'tdf-mobile',
        requestId: expect.any(String),
      }),
    );
    expect(jest.mocked(patch).mock.calls[0]?.[0]).not.toMatch(/payments|invoices|bookings/);
  });
});
