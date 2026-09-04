import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import { normalizePartyId } from './identity';
import type {
  EventLiveBroadcast,
  EventLiveBroadcastCreateInput,
  EventLiveBroadcastHeartbeatInput,
  EventLiveBroadcastQuality,
  ID,
} from '../types';

const STORAGE_KEY = 'tdf-event-live-broadcasts';
const MAX_TITLE_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 280;
const QUALITY_VALUES = ['auto', '720p', '480p'] as const;

const EventLiveBroadcastSchema = z.object({
  id: z.string().trim().min(1),
  eventId: z.string().trim().min(1),
  artistId: z.string().trim().min(1),
  artistName: z.string().trim().min(1),
  broadcasterName: z.string().trim().min(1),
  broadcasterPartyId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
  description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).nullable().optional(),
  status: z.enum(['live', 'ended']),
  playbackUrl: z.string().trim().min(1).nullable().optional(),
  ingestUrl: z.string().trim().min(1).nullable().optional(),
  whipUrl: z.string().trim().min(1).nullable().optional(),
  streamKey: z.string().trim().min(1).nullable().optional(),
  viewerCount: z.number().int().nonnegative(),
  startedAt: z.string().trim().min(1),
  endedAt: z.string().trim().min(1).nullable().optional(),
  lastHeartbeatAt: z.string().trim().min(1),
});

const EventLiveBroadcastStoreSchema = z.record(z.string(), z.array(z.unknown()));

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeEventId = (value: unknown): string | null => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? String(parsed) : null;
  }
  return trimmed;
};

const normalizeTimestamp = (value: unknown): string | null => {
  const text = normalizeText(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
};

const normalizeOptionalUrl = (value: unknown): string | null => normalizeText(value);

const createLocalId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const sortBroadcasts = (broadcasts: EventLiveBroadcast[]): EventLiveBroadcast[] =>
  [...broadcasts].sort((left, right) => {
    const statusDelta = Number(right.status === 'live') - Number(left.status === 'live');
    if (statusDelta !== 0) return statusDelta;
    return Date.parse(right.startedAt) - Date.parse(left.startedAt);
  });

const normalizeQuality = (value: EventLiveBroadcastQuality | undefined): EventLiveBroadcastQuality =>
  value && QUALITY_VALUES.includes(value) ? value : 'auto';

const sanitizeBroadcast = (broadcast: unknown): EventLiveBroadcast | null => {
  const parsed = EventLiveBroadcastSchema.safeParse(broadcast);
  if (!parsed.success) return null;

  const eventId = normalizeEventId(parsed.data.eventId);
  const artistId = normalizeEventId(parsed.data.artistId);
  const startedAt = normalizeTimestamp(parsed.data.startedAt);
  const lastHeartbeatAt = normalizeTimestamp(parsed.data.lastHeartbeatAt) ?? startedAt;
  if (!eventId || !artistId || !startedAt || !lastHeartbeatAt) return null;

  return {
    id: parsed.data.id.trim(),
    eventId,
    artistId,
    artistName: parsed.data.artistName.trim(),
    broadcasterName: parsed.data.broadcasterName.trim(),
    broadcasterPartyId: normalizePartyId(parsed.data.broadcasterPartyId),
    title: parsed.data.title.trim(),
    description: normalizeText(parsed.data.description),
    status: parsed.data.status,
    playbackUrl: normalizeOptionalUrl(parsed.data.playbackUrl),
    ingestUrl: normalizeOptionalUrl(parsed.data.ingestUrl),
    whipUrl: normalizeOptionalUrl(parsed.data.whipUrl),
    streamKey: normalizeOptionalUrl(parsed.data.streamKey),
    viewerCount: Math.max(0, parsed.data.viewerCount),
    startedAt,
    endedAt: normalizeTimestamp(parsed.data.endedAt),
    lastHeartbeatAt,
  };
};

const sanitizeStore = (store: unknown): Record<string, EventLiveBroadcast[]> => {
  const parsed = EventLiveBroadcastStoreSchema.safeParse(store);
  if (!parsed.success) return {};

  return Object.fromEntries(
    Object.entries(parsed.data)
      .map(([eventId, broadcasts]) => {
        const normalizedEventId = normalizeEventId(eventId);
        if (!normalizedEventId) return null;

        const sanitizedBroadcasts = sortBroadcasts(
          broadcasts
            .map((broadcast) => sanitizeBroadcast(broadcast))
            .filter(
              (broadcast): broadcast is EventLiveBroadcast =>
                Boolean(broadcast) && broadcast.eventId === normalizedEventId,
            ),
        );

        return sanitizedBroadcasts.length > 0 ? [normalizedEventId, sanitizedBroadcasts] : null;
      })
      .filter((entry): entry is [string, EventLiveBroadcast[]] => Boolean(entry)),
  );
};

async function readStore(): Promise<Record<string, EventLiveBroadcast[]>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitizeStore(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

async function writeStore(store: Record<string, EventLiveBroadcast[]>): Promise<void> {
  try {
    const entries = Object.entries(store).filter(([, broadcasts]) => broadcasts.length > 0);
    if (entries.length === 0) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Keep live controls responsive when local persistence is unavailable.
  }
}

async function updateBroadcasts(
  rawEventId: ID,
  updater: (current: EventLiveBroadcast[]) => EventLiveBroadcast[],
): Promise<EventLiveBroadcast[]> {
  const eventId = normalizeEventId(rawEventId);
  if (!eventId) return [];

  const store = await readStore();
  const nextBroadcasts = sortBroadcasts(
    updater(store[eventId] ?? [])
      .map((broadcast) => sanitizeBroadcast(broadcast))
      .filter((broadcast): broadcast is EventLiveBroadcast => Boolean(broadcast)),
  );
  const nextStore = { ...store };

  if (nextBroadcasts.length === 0) {
    delete nextStore[eventId];
  } else {
    nextStore[eventId] = nextBroadcasts;
  }

  await writeStore(nextStore);
  return nextStore[eventId] ?? [];
}

export function countLiveBroadcasts(broadcasts: EventLiveBroadcast[]): number {
  return broadcasts.filter((broadcast) => broadcast.status === 'live').length;
}

export async function listEventLiveBroadcasts(eventId: ID): Promise<EventLiveBroadcast[]> {
  const normalized = normalizeEventId(eventId);
  if (!normalized) return [];
  const store = await readStore();
  return store[normalized] ?? [];
}

export async function createEventLiveBroadcast(
  input: EventLiveBroadcastCreateInput,
): Promise<EventLiveBroadcast> {
  const eventId = normalizeEventId(input.eventId);
  const artistId = normalizeEventId(input.artistId);
  const artistName = normalizeText(input.artistName);
  const broadcasterName = normalizeText(input.broadcasterName);
  const broadcasterPartyId = normalizePartyId(input.broadcasterPartyId);
  const title = normalizeText(input.title) ?? 'En vivo desde el evento';
  const description = normalizeText(input.description);
  if (!eventId) throw new Error('Evento inválido para iniciar transmisión.');
  if (!artistId) throw new Error('Selecciona el artista del fanclub.');
  if (!artistName) throw new Error('No pudimos identificar el artista.');
  if (!broadcasterName) throw new Error('Agrega un nombre para transmitir.');
  if (!broadcasterPartyId) throw new Error('Tu sesión no tiene una identidad vinculada para transmitir como fan.');
  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(`El título no puede exceder ${MAX_TITLE_LENGTH} caracteres.`);
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`La descripción no puede exceder ${MAX_DESCRIPTION_LENGTH} caracteres.`);
  }

  const nowIso = new Date().toISOString();
  const broadcast: EventLiveBroadcast = {
    id: createLocalId('live'),
    eventId,
    artistId,
    artistName,
    broadcasterName,
    broadcasterPartyId,
    title,
    description,
    status: 'live',
    playbackUrl: normalizeOptionalUrl(input.playbackUrl),
    ingestUrl: normalizeOptionalUrl(input.ingestUrl),
    whipUrl: normalizeOptionalUrl(input.whipUrl),
    streamKey: normalizeOptionalUrl(input.streamKey),
    viewerCount: 1,
    startedAt: nowIso,
    endedAt: null,
    lastHeartbeatAt: nowIso,
  };

  await updateBroadcasts(eventId, (current) => [
    broadcast,
    ...current.filter(
      (candidate) =>
        !(
          candidate.status === 'live' &&
          candidate.broadcasterPartyId === broadcasterPartyId &&
          candidate.artistId === artistId
        ),
    ),
  ]);
  return broadcast;
}

export async function endEventLiveBroadcast(input: {
  eventId: ID;
  broadcastId: string;
  broadcasterPartyId?: ID | null;
}): Promise<EventLiveBroadcast> {
  const actorPartyId = normalizePartyId(input.broadcasterPartyId);
  let updatedBroadcast: EventLiveBroadcast | null = null;
  const endedAt = new Date().toISOString();

  await updateBroadcasts(input.eventId, (current) =>
    current.map((broadcast) => {
      if (broadcast.id !== input.broadcastId) return broadcast;
      if (actorPartyId && broadcast.broadcasterPartyId && broadcast.broadcasterPartyId !== actorPartyId) {
        return broadcast;
      }
      updatedBroadcast = {
        ...broadcast,
        status: 'ended',
        endedAt,
        lastHeartbeatAt: endedAt,
      };
      return updatedBroadcast;
    }),
  );

  if (!updatedBroadcast) {
    throw new Error('No pudimos cerrar esta transmisión.');
  }
  return updatedBroadcast;
}

export async function heartbeatEventLiveBroadcast(
  input: EventLiveBroadcastHeartbeatInput,
): Promise<EventLiveBroadcast> {
  let updatedBroadcast: EventLiveBroadcast | null = null;
  const nowIso = new Date().toISOString();
  const viewerDelta = Math.max(-1000, Math.min(1000, Math.trunc(input.viewerDelta ?? 0)));

  await updateBroadcasts(input.eventId, (current) =>
    current.map((broadcast) => {
      if (broadcast.id !== input.broadcastId) return broadcast;
      updatedBroadcast = {
        ...broadcast,
        viewerCount: Math.max(0, broadcast.viewerCount + viewerDelta),
        lastHeartbeatAt: nowIso,
      };
      return updatedBroadcast;
    }),
  );

  if (!updatedBroadcast) {
    throw new Error('No pudimos actualizar esta transmisión.');
  }
  return updatedBroadcast;
}

export { normalizeQuality };
