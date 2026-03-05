import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ID } from '../types';

const STORAGE_KEY = 'tdf-saved-event-ids';

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

type ParsedStoredIds = {
  ids: string[];
  sanitized: boolean;
};

const parseStoredIds = (raw: string): ParsedStoredIds => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return { ids: [], sanitized: true };

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
  } catch {
    return { ids: [], sanitized: true };
  }
};

async function writeIds(ids: string[]): Promise<void> {
  try {
    if (ids.length === 0) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage write failures so save/unsave UX still responds.
  }
}

export async function listSavedEventIds(): Promise<string[]> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  const { ids, sanitized } = parseStoredIds(raw);
  if (ids.length === 0) {
    await writeIds([]);
    return [];
  }
  if (sanitized) {
    await writeIds(ids);
  }
  return ids;
}

export async function saveEvent(eventId: ID): Promise<string[]> {
  const normalized = normalizeEventId(eventId);
  if (!normalized) return listSavedEventIds();

  const current = await listSavedEventIds();
  const withoutCurrent = current.filter((id) => id !== normalized);
  const next = [normalized, ...withoutCurrent];
  await writeIds(next);
  return next;
}

export async function unsaveEvent(eventId: ID): Promise<string[]> {
  const normalized = normalizeEventId(eventId);
  const current = await listSavedEventIds();
  const next = current.filter((id) => id !== normalized);
  await writeIds(next);
  return next;
}

export async function toggleSavedEvent(eventId: ID): Promise<{ saved: boolean; ids: string[] }> {
  const normalized = normalizeEventId(eventId);
  if (!normalized) return { saved: false, ids: await listSavedEventIds() };

  const current = await listSavedEventIds();
  if (current.includes(normalized)) {
    const ids = await unsaveEvent(normalized);
    return { saved: false, ids };
  }

  const ids = await saveEvent(normalized);
  return { saved: true, ids };
}
