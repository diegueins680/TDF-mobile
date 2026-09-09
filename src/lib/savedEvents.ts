import AsyncStorage from '@react-native-async-storage/async-storage';

import { Directory } from '../api/directory';
import {
  assertAuthSession,
  authSessionRequestConfig,
  captureAuthSession,
  isConnectivityApiError,
  type AuthSessionBinding,
} from '../api/client';
import type { ID } from '../types';

// This Party-scoped key is the only legacy source with reliable account
// provenance. It is offered for explicit import and is never treated as the
// authoritative saved state.
const PENDING_IMPORT_KEY_PREFIX = 'tdf-saved-event-ids:party:';
const CONFIRMED_CACHE_KEY_PREFIX = 'tdf-saved-event-cache:v1:party:';

// Deliberately leave the former unscoped key unread and untouched. Its values
// have no account provenance and therefore cannot be imported safely.

export type SavedEventSnapshot = {
  ids: string[];
  pendingImportIds: string[];
  pendingImportError: string | null;
  source: 'server' | 'cache';
  cachedAt: string | null;
};

export type SavedEventChange = {
  saved: boolean;
  cacheUpdated: boolean;
};

export class SavedEventImportError extends Error {
  readonly importedCount: number;
  readonly totalCount: number;

  constructor(importedCount: number, totalCount: number) {
    super('No pudimos importar todos los eventos guardados. No se borró la copia de este dispositivo.');
    this.name = 'SavedEventImportError';
    this.importedCount = importedCount;
    this.totalCount = totalCount;
  }
}

const normalizePartyId = (partyId: unknown): string => {
  if (typeof partyId === 'number') {
    return Number.isSafeInteger(partyId) && partyId > 0 ? String(partyId) : '';
  }
  if (typeof partyId !== 'string') return '';
  const trimmed = partyId.trim();
  if (!/^\d+$/.test(trimmed)) return '';
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? String(parsed) : '';
};

const requirePartyId = (partyId: ID): string => {
  const normalizedPartyId = normalizePartyId(partyId);
  if (!normalizedPartyId) {
    throw new Error('A valid authenticated Party ID is required to access saved events.');
  }
  return normalizedPartyId;
};

const normalizeEventId = (eventId: unknown): string => {
  if (typeof eventId === 'number') {
    return Number.isSafeInteger(eventId) && eventId > 0 ? String(eventId) : '';
  }
  if (typeof eventId !== 'string') return '';
  const trimmed = eventId.trim();
  if (!/^\d+$/.test(trimmed)) return '';
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? String(parsed) : '';
};

const requireEventId = (eventId: ID): string => {
  const normalized = normalizeEventId(eventId);
  if (!normalized) throw new Error('A valid numeric event ID is required.');
  return normalized;
};

const uniqueEventIds = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const normalized = normalizeEventId(value);
    if (!normalized || seen.has(normalized)) return [];
    seen.add(normalized);
    return [normalized];
  });
};

const parsePendingIds = (raw: string): string[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Saved events data is corrupted and was left unchanged.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Saved events data has an unexpected format and was left unchanged.');
  }
  return uniqueEventIds(parsed);
};

type ConfirmedCache = {
  ids: string[];
  cachedAt: string;
};

const parseConfirmedCache = (raw: string): ConfirmedCache | null => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.ids) || typeof record.cachedAt !== 'string') return null;
    if (Number.isNaN(Date.parse(record.cachedAt))) return null;
    return { ids: uniqueEventIds(record.ids), cachedAt: record.cachedAt };
  } catch {
    return null;
  }
};

const pendingImportKey = (partyId: string): string =>
  `${PENDING_IMPORT_KEY_PREFIX}${partyId}`;

const confirmedCacheKey = (partyId: string): string =>
  `${CONFIRMED_CACHE_KEY_PREFIX}${partyId}`;

const readPendingImportIds = async (partyId: string): Promise<string[]> => {
  const raw = await AsyncStorage.getItem(pendingImportKey(partyId));
  return raw ? parsePendingIds(raw) : [];
};

const readConfirmedCache = async (partyId: string): Promise<ConfirmedCache | null> => {
  const raw = await AsyncStorage.getItem(confirmedCacheKey(partyId));
  return raw ? parseConfirmedCache(raw) : null;
};

const writeConfirmedCache = async (partyId: string, ids: string[]): Promise<void> => {
  const cache: ConfirmedCache = {
    ids: uniqueEventIds(ids),
    cachedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(confirmedCacheKey(partyId), JSON.stringify(cache));
};

let confirmedCacheWriteQueue: Promise<void> = Promise.resolve();

const updateConfirmedCache = async (
  binding: AuthSessionBinding,
  partyId: string,
  eventId: string,
  desiredSaved: boolean,
): Promise<void> => {
  const update = confirmedCacheWriteQueue
    .catch(() => undefined)
    .then(async () => {
      assertAuthSession(binding);
      const cached = await readConfirmedCache(partyId);
      assertAuthSession(binding);
      const currentIds = cached?.ids ?? [];
      const nextIds = desiredSaved
        ? [eventId, ...currentIds.filter((id) => id !== eventId)]
        : currentIds.filter((id) => id !== eventId);
      await writeConfirmedCache(partyId, nextIds);
      assertAuthSession(binding);
    });
  confirmedCacheWriteQueue = update.catch(() => undefined);
  return update;
};

const pendingImportState = async (partyId: string): Promise<{
  ids: string[];
  error: string | null;
}> => {
  try {
    return { ids: await readPendingImportIds(partyId), error: null };
  } catch (error) {
    return {
      ids: [],
      error: error instanceof Error
        ? error.message
        : 'No pudimos leer los guardados pendientes; la copia local quedó intacta.',
    };
  }
};

const serverEventIds = async (binding: AuthSessionBinding): Promise<string[]> => {
  const favorites = await Directory.favorites('event', authSessionRequestConfig(binding));
  return uniqueEventIds(
    favorites.flatMap((favorite) => (
      favorite.targetKind === 'event' ? [favorite.targetId] : []
    )),
  );
};

export async function loadSavedEventSnapshot(
  partyId: ID,
  authToken: string,
): Promise<SavedEventSnapshot> {
  const normalizedPartyId = requirePartyId(partyId);
  const binding = captureAuthSession(authToken);
  const [pending, cached] = await Promise.all([
    pendingImportState(normalizedPartyId),
    readConfirmedCache(normalizedPartyId).catch(() => null),
  ]);
  assertAuthSession(binding);
  try {
    const ids = await serverEventIds(binding);
    assertAuthSession(binding);
    try {
      await writeConfirmedCache(normalizedPartyId, ids);
      assertAuthSession(binding);
    } catch {
      // A cache failure must not turn an acknowledged server read into an
      // offline result or a false error.
    }
    return {
      ids,
      pendingImportIds: pending.ids,
      pendingImportError: pending.error,
      source: 'server',
      cachedAt: null,
    };
  } catch (error) {
    assertAuthSession(binding);
    if (!cached || !isConnectivityApiError(error)) throw error;
    return {
      ids: cached.ids,
      pendingImportIds: pending.ids,
      pendingImportError: pending.error,
      source: 'cache',
      cachedAt: cached.cachedAt,
    };
  }
}

export async function setSavedEventDesiredState(
  partyId: ID,
  eventId: ID,
  desiredSaved: boolean,
  authToken: string,
): Promise<SavedEventChange> {
  const normalizedPartyId = requirePartyId(partyId);
  const normalizedEventId = requireEventId(eventId);
  const binding = captureAuthSession(authToken);
  const requestConfig = authSessionRequestConfig(binding);

  if (desiredSaved) {
    await Directory.addFavorite('event', normalizedEventId, requestConfig);
  } else {
    await Directory.removeFavorite('event', normalizedEventId, requestConfig);
  }
  assertAuthSession(binding);

  let cacheUpdated = true;
  try {
    await updateConfirmedCache(
      binding,
      normalizedPartyId,
      normalizedEventId,
      desiredSaved,
    );
  } catch {
    cacheUpdated = false;
  }
  return { saved: desiredSaved, cacheUpdated };
}

export async function importPendingSavedEvents(
  partyId: ID,
  authToken: string,
): Promise<{ importedCount: number; ids: string[] }> {
  const normalizedPartyId = requirePartyId(partyId);
  const binding = captureAuthSession(authToken);
  const pendingIds = await readPendingImportIds(normalizedPartyId);
  assertAuthSession(binding);
  if (pendingIds.length === 0) {
    const snapshot = await loadSavedEventSnapshot(normalizedPartyId, authToken);
    return { importedCount: 0, ids: snapshot.ids };
  }

  let importedCount = 0;
  for (const eventId of pendingIds) {
    try {
      assertAuthSession(binding);
      await Directory.addFavorite('event', eventId, authSessionRequestConfig(binding));
      assertAuthSession(binding);
      importedCount += 1;
    } catch {
      assertAuthSession(binding);
      throw new SavedEventImportError(importedCount, pendingIds.length);
    }
  }

  assertAuthSession(binding);
  const cached = await readConfirmedCache(normalizedPartyId);
  assertAuthSession(binding);
  const ids = uniqueEventIds([...(cached?.ids ?? []), ...pendingIds]);
  await writeConfirmedCache(normalizedPartyId, ids);
  assertAuthSession(binding);
  await AsyncStorage.removeItem(pendingImportKey(normalizedPartyId));
  assertAuthSession(binding);
  return { importedCount, ids };
}
