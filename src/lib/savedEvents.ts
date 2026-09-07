import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ID } from '../types';

// Deliberately leave the former `tdf-saved-event-ids` key unread and untouched.
// Its values have no account provenance and therefore cannot be imported safely.
const ACCOUNT_STORAGE_KEY_PREFIX = 'tdf-saved-event-ids:party:';

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

const requireStorageKey = (partyId: ID): string => {
  const normalizedPartyId = normalizePartyId(partyId);
  if (!normalizedPartyId) {
    throw new Error('A valid authenticated Party ID is required to access saved events.');
  }
  return `${ACCOUNT_STORAGE_KEY_PREFIX}${normalizedPartyId}`;
};

const normalizeEventId = (eventId: unknown): string => {
  if (typeof eventId === 'number') {
    return Number.isSafeInteger(eventId) && eventId > 0 ? String(eventId) : '';
  }
  if (typeof eventId !== 'string') return '';
  const trimmed = eventId.trim();
  if (!trimmed) return '';
  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? String(parsed) : '';
  }
  return trimmed;
};

const requireEventId = (eventId: ID): string => {
  const normalized = normalizeEventId(eventId);
  if (!normalized) throw new Error('A valid event ID is required.');
  return normalized;
};

type ParsedStoredIds = {
  ids: string[];
  sanitized: boolean;
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
    if (!normalized) {
      sanitized = true;
      return;
    }
    if (seen.has(normalized)) {
      sanitized = true;
      return;
    }
    seen.add(normalized);
    ids.push(normalized);
    if (typeof value !== 'string' || normalized !== value.trim()) {
      sanitized = true;
    }
  });

  return { ids, sanitized };
};

async function writeIds(storageKey: string, ids: string[]): Promise<void> {
  if (ids.length === 0) {
    await AsyncStorage.removeItem(storageKey);
    return;
  }
  await AsyncStorage.setItem(storageKey, JSON.stringify(ids));
}

export async function listSavedEventIds(partyId: ID): Promise<string[]> {
  const storageKey = requireStorageKey(partyId);
  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) return [];
  const { ids, sanitized } = parseStoredIds(raw);
  if (ids.length === 0) {
    await writeIds(storageKey, []);
    return [];
  }
  if (sanitized) {
    await writeIds(storageKey, ids);
  }
  return ids;
}

export async function saveEvent(partyId: ID, eventId: ID): Promise<string[]> {
  const storageKey = requireStorageKey(partyId);
  const normalized = requireEventId(eventId);
  const current = await listSavedEventIds(partyId);
  const withoutCurrent = current.filter((id) => id !== normalized);
  const next = [normalized, ...withoutCurrent];
  await writeIds(storageKey, next);
  return next;
}

export async function unsaveEvent(partyId: ID, eventId: ID): Promise<string[]> {
  const storageKey = requireStorageKey(partyId);
  const normalized = requireEventId(eventId);
  const current = await listSavedEventIds(partyId);
  const next = current.filter((id) => id !== normalized);
  await writeIds(storageKey, next);
  return next;
}

export async function toggleSavedEvent(partyId: ID, eventId: ID): Promise<{ saved: boolean; ids: string[] }> {
  const storageKey = requireStorageKey(partyId);
  const normalized = requireEventId(eventId);
  const current = await listSavedEventIds(partyId);
  if (current.includes(normalized)) {
    const ids = current.filter((id) => id !== normalized);
    await writeIds(storageKey, ids);
    return { saved: false, ids };
  }

  const ids = [normalized, ...current];
  await writeIds(storageKey, ids);
  return { saved: true, ids };
}
