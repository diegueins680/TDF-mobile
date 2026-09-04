jest.mock('../src/api/client', () => ({
  http: { get: jest.fn() },
  normalizeApiError: (error: unknown) => error,
}));

import { searchPartiesForSelector } from '../src/api/partySelector';

const { http } = jest.requireMock('../src/api/client') as {
  http: { get: jest.Mock };
};

describe('mobile party selector API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('forwards the opaque cursor, bounded limit, exclusions, and cancellation signal', async () => {
    const signal = new AbortController().signal;
    http.get.mockResolvedValueOnce({ data: { items: [], nextCursor: null } });

    await searchPartiesForSelector('Ána', {
      kind: 'person',
      accountOnly: true,
      excludedPartyIds: [7],
      cursor: 15,
      limit: 10,
      signal,
    });

    expect(http.get).toHaveBeenCalledWith('/parties/search', {
      signal,
      params: {
        q: 'Ána',
        context: 'event_invitation',
        kind: 'person',
        accountOnly: true,
        excludePartyId: [7],
        cursor: 15,
        limit: 10,
      },
    });
  });
});
