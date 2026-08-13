import AsyncStorage from '@react-native-async-storage/async-storage';

const mockFetchRecordsFeed = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../src/api/records', () => ({
  fetchRecordsFeed: (...args: unknown[]) => mockFetchRecordsFeed(...args),
}));

import {
  parseRecordsSnapshot,
  refreshRecordsSnapshot,
  RECORDS_SNAPSHOT_STORAGE_KEY,
} from '../src/lib/recordsSnapshot';

const getItemMock = jest.mocked(AsyncStorage.getItem);
const setItemMock = jest.mocked(AsyncStorage.setItem);

const feed = {
  locale: 'es',
  revision: 9,
  collections: [{
    id: 'collection-1',
    code: 'tdf-records-releases',
    kind: 'release' as const,
    name: 'RELEASES by TDF',
    resources: [],
    revision: 1,
  }],
  releases: [{
    id: 'release-1',
    code: 'spotify-release-track',
    title: 'Track',
    releaseTypeId: 'release-type-1',
    contributors: [],
    resources: [],
    sortOrder: 1,
    revision: 1,
  }],
  recordings: [],
  sessions: [],
};

describe('versioned offline Records snapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchRecordsFeed.mockReset();
    getItemMock.mockResolvedValue(null);
    setItemMock.mockResolvedValue(undefined);
  });

  it('persists a validated network feed with its revision and ETag', async () => {
    mockFetchRecordsFeed.mockResolvedValue({ feed, etag: '"catalog-9"', notModified: false });

    const snapshot = await refreshRecordsSnapshot('es');

    expect(snapshot?.source).toBe('network');
    expect(snapshot?.revision).toBe(9);
    expect(snapshot?.feed.releases[0]?.id).toBe('release-1');
    expect(setItemMock).toHaveBeenCalledWith(RECORDS_SNAPSHOT_STORAGE_KEY, expect.any(String));
    expect(parseRecordsSnapshot(setItemMock.mock.calls[0]?.[1] ?? '')?.source).toBe('cache');
  });

  it('uses last-known-good data offline and never invents emergency Records entities', async () => {
    const cached = await networkSnapshot();
    mockFetchRecordsFeed.mockRejectedValue(new Error('offline'));

    await expect(refreshRecordsSnapshot('es', cached)).resolves.toEqual({ ...cached, source: 'cache' });
    await expect(refreshRecordsSnapshot('en', cached)).resolves.toBeNull();
  });

  it('refreshes cache metadata after a conditional 304', async () => {
    const cached = await networkSnapshot();
    mockFetchRecordsFeed.mockResolvedValue({ feed: null, etag: '"catalog-9"', notModified: true });

    const snapshot = await refreshRecordsSnapshot('es', cached);

    expect(mockFetchRecordsFeed).toHaveBeenCalledWith('es', '"catalog-9"');
    expect(snapshot?.source).toBe('network');
    expect(snapshot?.feed).toEqual(feed);
  });

  it('rejects incomplete cached feeds instead of treating them as authoritative', () => {
    expect(parseRecordsSnapshot(JSON.stringify({
      schemaVersion: 1,
      revision: 9,
      locale: 'es',
      etag: '"catalog-9"',
      syncedAt: new Date().toISOString(),
      source: 'network',
      feed: { ...feed, releases: [{ id: 'missing-fields' }] },
    }))).toBeNull();
  });
});

async function networkSnapshot() {
  mockFetchRecordsFeed.mockResolvedValueOnce({ feed, etag: '"catalog-9"', notModified: false });
  const snapshot = await refreshRecordsSnapshot('es');
  if (!snapshot) throw new Error('expected network snapshot');
  setItemMock.mockClear();
  return snapshot;
}
