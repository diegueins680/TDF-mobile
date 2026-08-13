const mockGet = jest.fn();
const mockPost = jest.fn();
const mockNormalizeApiError = jest.fn((error: unknown) => error);

jest.mock('../src/api/client', () => ({
  http: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
  normalizeApiError: (error: unknown) => mockNormalizeApiError(error),
}));

import { Catalogs, type CatalogDraft } from '../src/api/catalogs';

describe('mobile catalog administration API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the server-owned catalog menu and performs encoded remote search', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    await Catalogs.listDefinitions('es EC');
    expect(mockGet).toHaveBeenCalledWith('/catalog/definitions?locale=es+EC');

    mockGet.mockResolvedValueOnce({ data: {} });
    await Catalogs.listItems('radio options', {
      locale: 'en',
      q: 'long duration',
      page: 2,
      pageSize: 50,
      includeInactive: true,
    });
    expect(mockGet).toHaveBeenLastCalledWith(
      '/catalog/radio%20options/items?locale=en&q=long+duration&page=2&pageSize=50&includeInactive=true',
    );
  });

  it('uses revision UUID routes and sends the strict generated draft unchanged', async () => {
    const draft: CatalogDraft = {
      entityId: '11111111-1111-4111-8111-111111111111',
      baseVersion: 2,
      code: 'system',
      nameEs: 'Sistema',
      nameEn: 'System',
      searchAliasesEs: [],
      searchAliasesEn: [],
      sortOrder: 0,
      appearanceMode: { defaultForApplication: true },
      reason: 'Revisión móvil',
      sourcePlatform: 'mobile-admin',
      correlationId: 'mobile-catalog:test',
    };
    mockPost.mockResolvedValue({ data: {} });

    await Catalogs.createRevision('appearance modes', draft);
    expect(mockPost).toHaveBeenCalledWith('/catalog/appearance%20modes/revisions', draft);

    await Catalogs.submitRevision('revision/id');
    expect(mockPost).toHaveBeenLastCalledWith('/catalog/revisions/revision%2Fid/submit');
    expect(draft).not.toHaveProperty('slug');
  });

  it('loads the specialized Radio policy instead of inferring minutes from labels or codes', async () => {
    mockGet.mockResolvedValueOnce({ data: { catalogId: 'catalog-id', revision: 1, options: [] } });

    await Catalogs.listRadioAutoStopOptions('en US');

    expect(mockGet).toHaveBeenCalledWith('/radio/auto-stop-options?locale=en+US');
  });

  it('normalizes protected API failures', async () => {
    const failure = new Error('forbidden');
    mockGet.mockRejectedValueOnce(failure);

    await expect(Catalogs.listDefinitions('es')).rejects.toBe(failure);
    expect(mockNormalizeApiError).toHaveBeenCalledWith(failure);
  });
});
