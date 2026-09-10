import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RSVPStatus } from '../types';
import { canonicalEventPath } from './eventSharing';

const KEY = '@tdf/event-rsvp-intent/v1';
const TTL_MS = 30 * 60 * 1000;

export type EventRsvpIntent = {
  version: 1;
  nonce: string;
  eventId: string;
  status: Exclude<RSVPStatus, 'NONE'>;
  showOnProfile: boolean;
  returnTo: `/eventos/${string}`;
  origin: 'public_event_detail' | 'internal_event_detail' | 'event_card';
  sharedAttribution: boolean;
  createdAt: number;
  expiresAt: number;
};

export async function saveEventRsvpIntent(
  input: Pick<EventRsvpIntent, 'eventId' | 'status' | 'showOnProfile' | 'origin'> & { sharedAttribution?: boolean },
  now = Date.now(),
): Promise<EventRsvpIntent> {
  const returnTo = canonicalEventPath(input.eventId);
  const intent: EventRsvpIntent = {
    ...input,
    eventId: input.eventId.trim(),
    version: 1,
    nonce: `${now.toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
    returnTo,
    sharedAttribution: input.sharedAttribution === true,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(intent));
  return intent;
}

export async function readEventRsvpIntent(expectedEventId?: string | null, now = Date.now()): Promise<EventRsvpIntent | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<EventRsvpIntent>;
    const eventId = typeof value.eventId === 'string' ? value.eventId.trim() : '';
    const returnTo = canonicalEventPath(eventId);
    if (
      value.version !== 1
      || typeof value.nonce !== 'string'
      || value.nonce.length < 8
      || !['GOING', 'INTERESTED', 'NOT_GOING'].includes(value.status ?? '')
      || typeof value.showOnProfile !== 'boolean'
      || !['public_event_detail', 'internal_event_detail', 'event_card'].includes(value.origin ?? '')
      || typeof value.sharedAttribution !== 'boolean'
      || value.returnTo !== returnTo
      || typeof value.createdAt !== 'number'
      || typeof value.expiresAt !== 'number'
      || value.expiresAt <= now
      || value.expiresAt - value.createdAt !== TTL_MS
      || (expectedEventId && expectedEventId.trim() !== eventId)
    ) return null;
    return value as EventRsvpIntent;
  } catch {
    return null;
  }
}

export async function clearEventRsvpIntent(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export const eventRsvpIntentStorageKey = KEY;
