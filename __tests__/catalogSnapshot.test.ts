import AsyncStorage from '@react-native-async-storage/async-storage';

const mockFetchCatalogBatch = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../src/api/catalogs', () => ({
  fetchCatalogBatch: (...args: unknown[]) => mockFetchCatalogBatch(...args),
}));

import {
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
  catalogCodes,
  emergencyCatalogSnapshot,
  parseCatalogSnapshot,
  refreshCatalogSnapshot,
  type CatalogSnapshot,
} from '../src/lib/catalogSnapshot';

const EVENT_TYPE_IDS: Record<string, string> = {
  party: '41000000-0000-4000-8000-000000000001',
  concert: '41000000-0000-4000-8000-000000000002',
};

const page = (
  code: string,
  values: string[],
  defaultCode?: string,
  defaultScopeKind = 'appearance-mode',
) => {
  const items = values.map((value, index) => ({
    id: code === 'event-types' ? EVENT_TYPE_IDS[value]! : `${code}-${value}`,
    catalogId: `catalog-${code}`,
    catalogCode: code,
    kind: `${code}-reference`,
    code: value,
    name: value,
    nameEs: value,
    nameEn: value,
    searchAliases: [],
    sortOrder: index,
    active: true,
    workflowState: 'published',
    deprecatedAt: undefined as string | undefined,
    usageCount: 0,
    version: 1,
  }));
  return {
    catalog: {
    id: `catalog-${code}`,
    code,
    classification: 'governed-reference-data',
    entityKind: `${code}-reference`,
    name: code,
    publicRead: true,
    sensitive: true,
    orderingMode: 'manual',
    cacheRevision: 3,
    active: true,
    version: 1,
    },
    items,
    defaults: defaultCode
      ? [{
          entityId: code === 'event-types' ? EVENT_TYPE_IDS[defaultCode]! : `${code}-${defaultCode}`,
          scopeKind: defaultScopeKind,
          scopeId: 'global',
          version: 1,
        }]
      : [],
    page: 1,
    pageSize: values.length,
    total: values.length,
    revision: 3,
    locale: 'es',
  };
};

const batch = {
  catalogs: [
    page('locales', ['es', 'en', 'fr']),
    page('currencies', ['USD', 'EUR']),
    page('genres', ['rock', 'pop']),
    page('countries', ['EC', 'US']),
    page('appearance-modes', ['system', 'light', 'dark'], 'system'),
    page('event-types', ['party', 'concert'], 'party', 'social-event'),
  ],
  revision: 3,
  locale: 'es',
};

describe('versioned catalog snapshots', () => {
  const getItemMock = jest.mocked(AsyncStorage.getItem);
  const setItemMock = jest.mocked(AsyncStorage.setItem);

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchCatalogBatch.mockReset();
    getItemMock.mockResolvedValue(null);
    setItemMock.mockResolvedValue(undefined);
  });

  it('uses marked emergency values only when neither API nor a valid cache is available', async () => {
    mockFetchCatalogBatch.mockRejectedValue(new Error('offline'));

    const snapshot = await refreshCatalogSnapshot('es');

    expect(snapshot.source).toBe('emergency');
    expect(snapshot.revision).toBe(0);
    expect(catalogCodes(snapshot, 'locales')).toEqual(['es', 'en']);
    expect(catalogCodes(snapshot, 'currencies')).toEqual(['USD']);
    expect(catalogCodes(snapshot, 'genres')).toEqual([]);
    expect(catalogCodes(snapshot, 'countries')).toEqual([]);
    expect(catalogCodes(snapshot, 'appearance-modes')).toEqual(['system', 'light', 'dark']);
    expect(catalogCodes(snapshot, 'event-types')).toEqual([]);
    expect(setItemMock).not.toHaveBeenCalled();
  });

  it('rejects pre-genre snapshot schemas so stale label-only data cannot become authoritative', () => {
    const legacySnapshot = {
      ...emergencyCatalogSnapshot(),
      schemaVersion: 1,
      source: 'network',
      catalogs: Object.fromEntries(batch.catalogs.map((catalogPage) => [catalogPage.catalog.code, catalogPage])),
    };

    expect(parseCatalogSnapshot(JSON.stringify(legacySnapshot))).toBeNull();
  });

  it('upgrades a valid v2 snapshot in memory while country data refreshes', () => {
    const legacyV2Snapshot = {
      ...emergencyCatalogSnapshot(),
      schemaVersion: 2,
      source: 'network',
      catalogs: Object.fromEntries(
        batch.catalogs
          .filter((catalogPage) => !['countries', 'appearance-modes', 'event-types'].includes(catalogPage.catalog.code))
          .map((catalogPage) => [catalogPage.catalog.code, catalogPage]),
      ),
    };

    const upgraded = parseCatalogSnapshot(JSON.stringify(legacyV2Snapshot));

    expect(upgraded?.schemaVersion).toBe(CATALOG_SNAPSHOT_SCHEMA_VERSION);
    expect(catalogCodes(upgraded!, 'countries')).toEqual([]);
    expect(catalogCodes(upgraded!, 'appearance-modes')).toEqual(['system', 'light', 'dark']);
    expect(catalogCodes(upgraded!, 'event-types')).toEqual([]);
    expect(upgraded?.etag).toBeNull();
  });

  it('upgrades a valid v4 snapshot without reusing its now-incomplete ETag', () => {
    const legacyV4Snapshot = {
      ...emergencyCatalogSnapshot(),
      schemaVersion: 4,
      source: 'network',
      etag: '"catalog-v4"',
      catalogs: Object.fromEntries(
        batch.catalogs
          .filter((catalogPage) => catalogPage.catalog.code !== 'event-types')
          .map((catalogPage) => [catalogPage.catalog.code, catalogPage]),
      ),
    };

    const upgraded = parseCatalogSnapshot(JSON.stringify(legacyV4Snapshot));

    expect(upgraded?.schemaVersion).toBe(CATALOG_SNAPSHOT_SCHEMA_VERSION);
    expect(upgraded?.etag).toBeNull();
    expect(catalogCodes(upgraded!, 'event-types')).toEqual([]);
  });

  it('persists a complete network snapshot and replaces emergency data', async () => {
    mockFetchCatalogBatch.mockResolvedValue({ batch, etag: '"catalog-3"', notModified: false });

    const snapshot = await refreshCatalogSnapshot('es', emergencyCatalogSnapshot());

    expect(snapshot.source).toBe('network');
    expect(snapshot.revision).toBe(3);
    expect(snapshot.etag).toBe('"catalog-3"');
    expect(catalogCodes(snapshot, 'locales')).toEqual(['es', 'en', 'fr']);
    expect(catalogCodes(snapshot, 'currencies')).toEqual(['USD', 'EUR']);
    expect(catalogCodes(snapshot, 'genres')).toEqual(['rock', 'pop']);
    expect(catalogCodes(snapshot, 'countries')).toEqual(['EC', 'US']);
    expect(catalogCodes(snapshot, 'appearance-modes')).toEqual(['system', 'light', 'dark']);
    expect(catalogCodes(snapshot, 'event-types')).toEqual(['party', 'concert']);
    expect(setItemMock).toHaveBeenCalledTimes(1);
    expect(parseCatalogSnapshot(setItemMock.mock.calls[0]?.[1] ?? '')?.revision).toBe(3);
  });

  it('rejects cached appearance data with unknown or inactive canonical values', () => {
    const catalogs = Object.fromEntries(batch.catalogs.map((catalogPage) => [catalogPage.catalog.code, catalogPage]));
    const baseSnapshot = {
      ...emergencyCatalogSnapshot(),
      schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
      source: 'network',
      revision: 3,
      catalogs,
    };
    const unknownMode = page('appearance-modes', ['system', 'sepia'], 'system');
    expect(parseCatalogSnapshot(JSON.stringify({
      ...baseSnapshot,
      catalogs: { ...catalogs, 'appearance-modes': unknownMode },
    }))).toBeNull();

    const inactiveDefault = page('appearance-modes', ['system', 'light'], 'system');
    inactiveDefault.items[0]!.active = false;
    expect(parseCatalogSnapshot(JSON.stringify({
      ...baseSnapshot,
      catalogs: { ...catalogs, 'appearance-modes': inactiveDefault },
    }))).toBeNull();
  });

  it('rejects event type snapshots without one active published global default', () => {
    const catalogs = Object.fromEntries(batch.catalogs.map((catalogPage) => [catalogPage.catalog.code, catalogPage]));
    const baseSnapshot = {
      ...emergencyCatalogSnapshot(),
      schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
      source: 'network',
      revision: 3,
      catalogs,
    };
    const missingDefault = page('event-types', ['party', 'concert']);
    expect(parseCatalogSnapshot(JSON.stringify({
      ...baseSnapshot,
      catalogs: { ...catalogs, 'event-types': missingDefault },
    }))).toBeNull();

    const deprecatedDefault = page('event-types', ['party', 'concert'], 'party', 'social-event');
    deprecatedDefault.items[0]!.deprecatedAt = '2026-08-11T00:00:00.000Z';
    expect(parseCatalogSnapshot(JSON.stringify({
      ...baseSnapshot,
      catalogs: { ...catalogs, 'event-types': deprecatedDefault },
    }))).toBeNull();
  });

  it('keeps the last-known-good snapshot on API failure or an incomplete response', async () => {
    mockFetchCatalogBatch.mockResolvedValue({
      batch: { ...batch, catalogs: [page('locales', ['es'])] },
      etag: '"broken"',
      notModified: false,
    });
    const cached: CatalogSnapshot = {
      ...emergencyCatalogSnapshot(),
      schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
      source: 'network' as const,
      revision: 2,
      etag: '"catalog-2"',
      catalogs: Object.fromEntries(batch.catalogs.map((catalogPage) => [catalogPage.catalog.code, catalogPage])),
    };

    await expect(refreshCatalogSnapshot('es', cached)).resolves.toEqual(cached);
    expect(setItemMock).not.toHaveBeenCalled();

    mockFetchCatalogBatch.mockRejectedValue(new Error('offline'));
    await expect(refreshCatalogSnapshot('es', cached)).resolves.toEqual(cached);
  });

  it('reuses a matching cached snapshot after a conditional 304 response', async () => {
    const cached: CatalogSnapshot = {
      ...emergencyCatalogSnapshot(),
      schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
      source: 'network' as const,
      revision: 3,
      locale: 'es',
      etag: '"catalog-3"',
      catalogs: Object.fromEntries(batch.catalogs.map((catalogPage) => [catalogPage.catalog.code, catalogPage])),
    };
    mockFetchCatalogBatch.mockResolvedValue({ batch: null, etag: '"catalog-3"', notModified: true });

    await expect(refreshCatalogSnapshot('es', cached)).resolves.toEqual(cached);
    expect(mockFetchCatalogBatch).toHaveBeenCalledWith(
      ['locales', 'currencies', 'appearance-modes', 'genres', 'countries', 'event-types'],
      'es',
      '"catalog-3"',
    );
    expect(setItemMock).not.toHaveBeenCalled();
  });
});
