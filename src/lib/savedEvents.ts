import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ID } from '../types';

const STORAGE_KEY = 'tdf-saved-event-ids';

const normalizeEventId = (eventId: unknown): string => {
  if (typeof eventId !== 'string' && typeof eventId !== 'number') return '';
  return String(eventId).trim();
};

const parseStoredIds = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    const ids: string[] = [];

    parsed.forEach((value) => {
      const normalized = normalizeEventId(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      ids.push(normalized);
    });

    return ids;
  } catch {
    return [];
  }
};

async function writeIds(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export async function listSavedEventIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = parseStoredIds(raw);
  if (parsed.length === 0) {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
  return parsed;
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
