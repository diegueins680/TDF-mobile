import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import {
  deleteDirectoryEventFavorite,
  listDirectoryEventFavorites,
  saveDirectoryEventFavorite,
} from '../api/directoryFavorites';
import type { ID } from '../types';
import { markFirstValueCompleted } from './onboardingIntent';

const LEGACY_STORAGE_KEY = 'tdf-saved-event-ids';
const ACCOUNT_STORAGE_KEY_PREFIX = 'tdf-saved-event-ids:party:';
const OUTBOX_STORAGE_KEY_PREFIX = 'tdf-saved-event-outbox:party:';

type PendingSavedEventChange = {
  eventId: string;
  desiredSaved: boolean;
};

export type SavedEventMutationResult = {
  saved: boolean;
  ids: string[];
  serverAcknowledged: boolean;
};

export type LegacySavedEventCandidate = { count: number };

export type LegacySavedEventImportResult = {
  importedCount: number;
  acknowledgedCount: number;
  pendingCount: number;
  ids: string[];
};

type ParsedStoredIds = { ids: string[]; sanitized: boolean };
type FlushResult = {
  acknowledged: PendingSavedEventChange[];
  retrying: PendingSavedEventChange[];
  rejected: Array<{ change: PendingSavedEventChange; error: unknown }>;
};
type StillOwnsParty = () => boolean;

const alwaysOwnsParty: StillOwnsParty = () => true;

const partyQueues = new Map<string, Promise<unknown>>();

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

const storageKeyFor = (partyId: string): string => `${ACCOUNT_STORAGE_KEY_PREFIX}${partyId}`;
const outboxKeyFor = (partyId: string): string => `${OUTBOX_STORAGE_KEY_PREFIX}${partyId}`;

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
  if (!normalized) throw new Error('A valid event ID is required.');
  return normalized;
};

const parseStoredIds = (raw: string): ParsedStoredIds => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Saved events data is corrupted and was left unchanged.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Saved events data has an unexpected format and was left unchanged.');
  }

  const seen = new Set<string>();
  const ids: string[] = [];
  let sanitized = false;
  parsed.forEach((value) => {
    const normalized = normalizeEventId(value);
    if (!normalized || seen.has(normalized)) {
      sanitized = true;
      return;
    }
    seen.add(normalized);
    ids.push(normalized);
    if (typeof value !== 'string' || normalized !== value.trim()) sanitized = true;
  });
  return { ids, sanitized };
};

const parseOutbox = (raw: string): PendingSavedEventChange[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Saved events sync data is corrupted and was left unchanged.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Saved events sync data has an unexpected format and was left unchanged.');
  }

  const desiredByEvent = new Map<string, boolean>();
  parsed.forEach((value) => {
    if (!value || typeof value !== 'object') return;
    const candidate = value as Partial<PendingSavedEventChange>;
    const eventId = normalizeEventId(candidate.eventId);
    if (!eventId || typeof candidate.desiredSaved !== 'boolean') return;
    desiredByEvent.delete(eventId);
    desiredByEvent.set(eventId, candidate.desiredSaved);
  });
  return [...desiredByEvent].map(([eventId, desiredSaved]) => ({ eventId, desiredSaved }));
};

async function writeIds(partyId: string, ids: string[]): Promise<void> {
  const storageKey = storageKeyFor(partyId);
  if (ids.length === 0) {
    await AsyncStorage.removeItem(storageKey);
    return;
  }
  await AsyncStorage.setItem(storageKey, JSON.stringify(ids));
}

async function readIds(partyId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(storageKeyFor(partyId));
  if (!raw) return [];
  const { ids, sanitized } = parseStoredIds(raw);
  if (ids.length === 0) await writeIds(partyId, []);
  else if (sanitized) await writeIds(partyId, ids);
  return ids;
}

async function readOutbox(partyId: string): Promise<PendingSavedEventChange[]> {
  const raw = await AsyncStorage.getItem(outboxKeyFor(partyId));
  return raw ? parseOutbox(raw) : [];
}

async function writeOutbox(partyId: string, changes: PendingSavedEventChange[]): Promise<void> {
  const storageKey = outboxKeyFor(partyId);
  if (changes.length === 0) {
    await AsyncStorage.removeItem(storageKey);
    return;
  }
  await AsyncStorage.setItem(storageKey, JSON.stringify(changes));
}

const upsertDesiredChange = (
  changes: PendingSavedEventChange[],
  eventId: string,
  desiredSaved: boolean,
): PendingSavedEventChange[] => [
  ...changes.filter((change) => change.eventId !== eventId),
  { eventId, desiredSaved },
];

const applyDesiredChanges = (ids: string[], changes: PendingSavedEventChange[]): string[] => {
  let ordered = [...ids];
  changes.forEach(({ eventId, desiredSaved }) => {
    const withoutEvent = ordered.filter((id) => id !== eventId);
    ordered = desiredSaved ? [eventId, ...withoutEvent] : withoutEvent;
  });
  return ordered;
};

const isRetryableSyncError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return true;
  const status = error.response?.status;
  return status === undefined || status === 408 || status === 429 || status >= 500;
};

async function flushOutbox(
  partyId: string,
  changes: PendingSavedEventChange[],
  stillOwnsParty: StillOwnsParty = alwaysOwnsParty,
): Promise<FlushResult> {
  const acknowledged: PendingSavedEventChange[] = [];
  const retrying: PendingSavedEventChange[] = [];
  const rejected: Array<{ change: PendingSavedEventChange; error: unknown }> = [];
  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index];
    if (!stillOwnsParty()) {
      retrying.push(...changes.slice(index));
      break;
    }
    try {
      if (change.desiredSaved) await saveDirectoryEventFavorite(change.eventId);
      else await deleteDirectoryEventFavorite(change.eventId);
      acknowledged.push(change);
    } catch (error) {
      if (isRetryableSyncError(error)) retrying.push(change);
      else rejected.push({ change, error });
    }
  }
  await writeOutbox(partyId, retrying);
  return { acknowledged, retrying, rejected };
}

async function retryOnboardingAfterAcknowledgedReplay(
  partyId: string,
  flush: FlushResult,
  stillOwnsParty: StillOwnsParty = alwaysOwnsParty,
): Promise<void> {
  if (stillOwnsParty() && flush.acknowledged.some((change) => change.desiredSaved)) {
    await markFirstValueCompleted(partyId, 'event_saved', stillOwnsParty);
  }
}

async function withPartyQueue<T>(partyId: string, action: () => Promise<T>): Promise<T> {
  const previous = partyQueues.get(partyId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(action);
  partyQueues.set(partyId, current);
  try {
    return await current;
  } finally {
    if (partyQueues.get(partyId) === current) partyQueues.delete(partyId);
  }
}

const remoteEventIds = async (stillOwnsParty: StillOwnsParty): Promise<string[]> => {
  if (!stillOwnsParty()) return [];
  const favorites = await listDirectoryEventFavorites();
  const seen = new Set<string>();
  return favorites.flatMap((favorite) => {
    if (favorite.targetKind !== 'event') return [];
    const eventId = normalizeEventId(favorite.targetId);
    if (!eventId || seen.has(eventId)) return [];
    seen.add(eventId);
    return [eventId];
  });
};

async function synchronizeSavedEventIdsWithinQueue(
  partyId: string,
  stillOwnsParty: StillOwnsParty = alwaysOwnsParty,
): Promise<string[]> {
  const [cachedIds, pendingChanges] = await Promise.all([
    readIds(partyId),
    readOutbox(partyId),
  ]);
  let authoritativeIds: string[];
  try {
    if (!stillOwnsParty()) return cachedIds;
    authoritativeIds = await remoteEventIds(stillOwnsParty);
  } catch (error) {
    if (!isRetryableSyncError(error)) throw error;
    authoritativeIds = cachedIds;
  }

  if (!stillOwnsParty()) return cachedIds;
  const flush = await flushOutbox(partyId, pendingChanges, stillOwnsParty);
  await retryOnboardingAfterAcknowledgedReplay(partyId, flush, stillOwnsParty);
  const nextIds = applyDesiredChanges(
    authoritativeIds,
    [...flush.acknowledged, ...flush.retrying],
  );
  await writeIds(partyId, nextIds);
  return nextIds;
}

export async function listSavedEventIds(
  partyId: ID,
  stillOwnsParty: StillOwnsParty = alwaysOwnsParty,
): Promise<string[]> {
  const normalizedPartyId = requirePartyId(partyId);
  return withPartyQueue(normalizedPartyId, () =>
    synchronizeSavedEventIdsWithinQueue(normalizedPartyId, stillOwnsParty));
}

async function setSavedEventDesiredStateWithinQueue(
  normalizedPartyId: string,
  normalizedEventId: string,
  desiredSaved: boolean,
  stillOwnsParty: StillOwnsParty = alwaysOwnsParty,
): Promise<SavedEventMutationResult> {
  const currentIds = await readIds(normalizedPartyId);
  const currentOutbox = await readOutbox(normalizedPartyId);
  const nextOutbox = upsertDesiredChange(currentOutbox, normalizedEventId, desiredSaved);
  const nextIds = applyDesiredChanges(currentIds, [{ eventId: normalizedEventId, desiredSaved }]);

  // Persist intent first so an interrupted cache write cannot lose the change.
  await writeOutbox(normalizedPartyId, nextOutbox);
  await writeIds(normalizedPartyId, nextIds);
  const flush = await flushOutbox(normalizedPartyId, nextOutbox, stillOwnsParty);
  const rejected = flush.rejected.find(({ change }) => change.eventId === normalizedEventId);
  if (rejected) {
    const restoredIds = applyDesiredChanges(nextIds, [{
      eventId: normalizedEventId,
      desiredSaved: currentIds.includes(normalizedEventId),
    }]);
    await writeIds(normalizedPartyId, restoredIds);
    throw rejected.error;
  }

  return {
    saved: desiredSaved,
    ids: nextIds,
    serverAcknowledged: flush.acknowledged.some(
      (change) => change.eventId === normalizedEventId && change.desiredSaved === desiredSaved,
    ),
  };
}

export async function saveEvent(
  partyId: ID,
  eventId: ID,
  stillOwnsParty: StillOwnsParty = alwaysOwnsParty,
): Promise<SavedEventMutationResult> {
  const normalizedPartyId = requirePartyId(partyId);
  const normalizedEventId = requireEventId(eventId);
  return withPartyQueue(normalizedPartyId, () =>
    setSavedEventDesiredStateWithinQueue(normalizedPartyId, normalizedEventId, true, stillOwnsParty));
}

export async function unsaveEvent(
  partyId: ID,
  eventId: ID,
  stillOwnsParty: StillOwnsParty = alwaysOwnsParty,
): Promise<SavedEventMutationResult> {
  const normalizedPartyId = requirePartyId(partyId);
  const normalizedEventId = requireEventId(eventId);
  return withPartyQueue(normalizedPartyId, () =>
    setSavedEventDesiredStateWithinQueue(normalizedPartyId, normalizedEventId, false, stillOwnsParty));
}

export async function toggleSavedEvent(
  partyId: ID,
  eventId: ID,
  stillOwnsParty: StillOwnsParty = alwaysOwnsParty,
): Promise<SavedEventMutationResult> {
  const normalizedPartyId = requirePartyId(partyId);
  const normalizedEventId = requireEventId(eventId);
  return withPartyQueue(normalizedPartyId, async () => {
    const ids = await synchronizeSavedEventIdsWithinQueue(normalizedPartyId, stillOwnsParty);
    return setSavedEventDesiredStateWithinQueue(
      normalizedPartyId,
      normalizedEventId,
      !ids.includes(normalizedEventId),
      stillOwnsParty,
    );
  });
}

// Normal reads never inspect the unscoped key; only the explicit account-binding
// prompt calls these functions because the original owner cannot be inferred.
export async function getLegacySavedEventCandidate(): Promise<LegacySavedEventCandidate | null> {
  const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  const { ids } = parseStoredIds(raw);
  return ids.length > 0 ? { count: ids.length } : null;
}

export async function importLegacySavedEvents(
  partyId: ID,
  stillOwnsParty: StillOwnsParty = alwaysOwnsParty,
): Promise<LegacySavedEventImportResult> {
  const normalizedPartyId = requirePartyId(partyId);
  return withPartyQueue(normalizedPartyId, async () => {
    const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      return { importedCount: 0, acknowledgedCount: 0, pendingCount: 0, ids: await readIds(normalizedPartyId) };
    }
    const { ids: legacyIds } = parseStoredIds(raw);
    const [currentIds, currentOutbox] = await Promise.all([
      readIds(normalizedPartyId),
      readOutbox(normalizedPartyId),
    ]);
    const importChanges = legacyIds.map((eventId) => ({ eventId, desiredSaved: true }));
    const nextOutbox = importChanges.reduce(
      (changes, change) => upsertDesiredChange(changes, change.eventId, true),
      currentOutbox,
    );
    const nextIds = applyDesiredChanges(currentIds, importChanges);

    await writeOutbox(normalizedPartyId, nextOutbox);
    await writeIds(normalizedPartyId, nextIds);
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    const flush = await flushOutbox(normalizedPartyId, nextOutbox, stillOwnsParty);
    await retryOnboardingAfterAcknowledgedReplay(normalizedPartyId, flush, stillOwnsParty);
    const rejectedIds = new Set(flush.rejected.map(({ change }) => change.eventId));
    const retainedIds = nextIds.filter((eventId) => !rejectedIds.has(eventId));
    if (retainedIds.length !== nextIds.length) await writeIds(normalizedPartyId, retainedIds);

    const importedIds = new Set(legacyIds);
    return {
      importedCount: legacyIds.length,
      acknowledgedCount: flush.acknowledged.filter(({ eventId }) => importedIds.has(eventId)).length,
      pendingCount: flush.retrying.filter(({ eventId }) => importedIds.has(eventId)).length,
      ids: retainedIds,
    };
  });
}
