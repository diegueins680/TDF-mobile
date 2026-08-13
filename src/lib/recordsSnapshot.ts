import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchRecordsFeed, type RecordsFeed } from '../api/records';

export const RECORDS_SNAPSHOT_SCHEMA_VERSION = 1;
export const RECORDS_SNAPSHOT_STORAGE_KEY = 'tdf-records-snapshot-v1';

export interface RecordsSnapshot {
  schemaVersion: typeof RECORDS_SNAPSHOT_SCHEMA_VERSION;
  revision: number;
  locale: string;
  etag: string | null;
  syncedAt: string;
  source: 'network' | 'cache';
  feed: RecordsFeed;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasCanonicalEntities = (items: unknown): boolean =>
  Array.isArray(items) && items.every((item) => (
    isRecord(item)
    && typeof item.id === 'string'
    && item.id.trim() !== ''
    && typeof item.code === 'string'
    && item.code.trim() !== ''
    && typeof item.title === 'string'
    && Array.isArray(item.contributors)
    && Array.isArray(item.resources)
  ));

const isValidFeed = (value: unknown): value is RecordsFeed => {
  if (!isRecord(value)) return false;
  if (typeof value.locale !== 'string' || typeof value.revision !== 'number' || value.revision < 1) return false;
  if (!Array.isArray(value.collections) || !value.collections.every((collection) => (
    isRecord(collection)
    && typeof collection.id === 'string'
    && typeof collection.code === 'string'
    && typeof collection.kind === 'string'
    && Array.isArray(collection.resources)
  ))) return false;
  return hasCanonicalEntities(value.releases)
    && hasCanonicalEntities(value.recordings)
    && hasCanonicalEntities(value.sessions);
};

export const parseRecordsSnapshot = (raw: string): RecordsSnapshot | null => {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value) || value.schemaVersion !== RECORDS_SNAPSHOT_SCHEMA_VERSION) return null;
    if (typeof value.revision !== 'number' || value.revision < 1) return null;
    if (typeof value.locale !== 'string' || typeof value.syncedAt !== 'string') return null;
    if (!(value.etag === null || typeof value.etag === 'string') || !isValidFeed(value.feed)) return null;
    return { ...(value as unknown as RecordsSnapshot), source: 'cache' };
  } catch {
    return null;
  }
};

export const loadLastKnownGoodRecordsSnapshot = async (): Promise<RecordsSnapshot | null> => {
  try {
    const raw = await AsyncStorage.getItem(RECORDS_SNAPSHOT_STORAGE_KEY);
    return raw ? parseRecordsSnapshot(raw) : null;
  } catch {
    return null;
  }
};

const persistSnapshot = async (snapshot: RecordsSnapshot): Promise<void> => {
  await AsyncStorage.setItem(
    RECORDS_SNAPSHOT_STORAGE_KEY,
    JSON.stringify({ ...snapshot, source: 'network' }),
  );
};

export const refreshRecordsSnapshot = async (
  locale: string,
  current?: RecordsSnapshot | null,
): Promise<RecordsSnapshot | null> => {
  const requestedLocale = locale.trim() || 'es';
  const stored = current ?? await loadLastKnownGoodRecordsSnapshot();
  const cached = stored?.locale === requestedLocale ? stored : null;
  try {
    const response = await fetchRecordsFeed(requestedLocale, cached?.etag);
    if (response.notModified) {
      if (!cached) return null;
      const verified = {
        ...cached,
        etag: response.etag ?? cached.etag,
        syncedAt: new Date().toISOString(),
        source: 'network' as const,
      };
      await persistSnapshot(verified);
      return verified;
    }
    if (!response.feed || !isValidFeed(response.feed)) {
      throw new Error('La API no devolvió una instantánea Records válida.');
    }
    const next: RecordsSnapshot = {
      schemaVersion: RECORDS_SNAPSHOT_SCHEMA_VERSION,
      revision: response.feed.revision,
      locale: response.feed.locale,
      etag: response.etag,
      syncedAt: new Date().toISOString(),
      source: 'network',
      feed: response.feed,
    };
    await persistSnapshot(next);
    return next;
  } catch {
    return cached ? { ...cached, source: 'cache' } : null;
  }
};
