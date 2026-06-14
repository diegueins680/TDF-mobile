import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import { normalizePartyId } from './identity';
import type {
  EventLiveBroadcast,
  EventLiveBroadcastCreateInput,
  EventLiveBroadcastHeartbeatInput,
  ID,
} from '../types';

const STORAGE_KEY = 'tdf-event-live-broadcasts';
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 280;
const MAX_VIEWER_COUNT = 1_000_000;

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
  viewerCount: z.number().int().nonnegative().max(MAX_VIEWER_COUNT),
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

const normalizeOptionalText = (value: unknown, maxLength: number): string | null => {
  const text = normalizeText(value);
  if (!text) return null;
  return text.length <= maxLength ? text : text.slice(0, maxLength);
};

const normalizeEntityId = (value: unknown): string | null => {
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

const createLocalId = (): string =>
  `live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const sortBroadcasts = (broadcasts: EventLiveBroadcast[]): EventLiveBroadcast[] =>
  [...broadcasts].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === 'live' ? -1 : 1;
    }
    return Date.parse(right.startedAt) - Date.parse(left.startedAt);
  });

const sanitizeBroadcast = (broadcast: unknown): EventLiveBroadcast | null => {
  const parsed = EventLiveBroadcastSchema.safeParse(broadcast);
  if (!parsed.success) return null;

  const eventId = normalizeEntityId(parsed.data.eventId);
  const artistId = normalizeEntityId(parsed.data.artistId);
  const startedAt = normalizeTimestamp(parsed.data.startedAt);
  const endedAt = normalizeTimestamp(parsed.data.endedAt);
  const lastHeartbeatAt = normalizeTimestamp(parsed.data.lastHeartbeatAt);
  if (!eventId || !artistId || !startedAt || !lastHeartbeatAt) return null;

  return {
    id: parsed.data.id.trim(),
    eventId,
    artistId,
    artistName: parsed.data.artistName.trim(),
    broadcasterName: parsed.data.broadcasterName.trim(),
    broadcasterPartyId: normalizePartyId(parsed.data.broadcasterPartyId),
    title: parsed.data.title.trim(),
    description: normalizeOptionalText(parsed.data.description, MAX_DESCRIPTION_LENGTH),
    status: parsed.data.status,
    playbackUrl: normalizeText(parsed.data.playbackUrl),
    ingestUrl: normalizeText(parsed.data.ingestUrl),
    whipUrl: normalizeText(parsed.data.whipUrl),
    streamKey: normalizeText(parsed.data.streamKey),
    viewerCount: Math.min(Math.max(0, parsed.data.viewerCount), MAX_VIEWER_COUNT),
    startedAt,
    endedAt,
    lastHeartbeatAt,
  };
};

const sanitizeStore = (store: unknown): Record<string, EventLiveBroadcast[]> => {
  const parsed = EventLiveBroadcastStoreSchema.safeParse(store);
  if (!parsed.success) return {};

  return Object.fromEntries(
    Object.entries(parsed.data)
      .map(([eventId, broadcasts]) => {
        const normalizedEventId = normalizeEntityId(eventId);
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
    // Ignore write failures so the event screen can continue rendering.
  }
}

async function updateBroadcasts(
  rawEventId: ID,
  updater: (current: EventLiveBroadcast[]) => EventLiveBroadcast[],
): Promise<EventLiveBroadcast[]> {
  const eventId = normalizeEntityId(rawEventId);
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
  const normalizedEventId = normalizeEntityId(eventId);
  if (!normalizedEventId) return [];
  const store = await readStore();
  return store[normalizedEventId] ?? [];
}

export async function createEventLiveBroadcast(
  input: EventLiveBroadcastCreateInput,
): Promise<EventLiveBroadcast> {
  const eventId = normalizeEntityId(input.eventId);
  const artistId = normalizeEntityId(input.artistId);
  const artistName = normalizeText(input.artistName);
  const broadcasterName = normalizeText(input.broadcasterName);
  const broadcasterPartyId = normalizePartyId(input.broadcasterPartyId);

  if (!eventId) throw new Error('Evento inválido para iniciar transmisión.');
  if (!artistId || !artistName) throw new Error('Elige un artista para definir el fanclub.');
  if (!broadcasterName) throw new Error('Agrega un nombre para transmitir.');
  if (!broadcasterPartyId) throw new Error('Configura tu Party ID para transmitir como fan.');

  const title = normalizeOptionalText(input.title, MAX_TITLE_LENGTH) ?? `${artistName} en vivo`;
  const description = normalizeOptionalText(input.description, MAX_DESCRIPTION_LENGTH);
  const now = new Date().toISOString();
  const id = createLocalId();

  const broadcast: EventLiveBroadcast = {
    id,
    eventId,
    artistId,
    artistName,
    broadcasterName,
    broadcasterPartyId,
    title,
    description,
    status: 'live',
    playbackUrl: normalizeText(input.playbackUrl) ?? `tdf://events/${encodeURIComponent(eventId)}/live/${encodeURIComponent(id)}`,
    ingestUrl: normalizeText(input.ingestUrl),
    whipUrl: normalizeText(input.whipUrl),
    streamKey: normalizeText(input.streamKey),
    viewerCount: 0,
    startedAt: now,
    endedAt: null,
    lastHeartbeatAt: now,
  };

  await updateBroadcasts(eventId, (current) => [broadcast, ...current]);
  return broadcast;
}

export async function endEventLiveBroadcast(input: {
  eventId: ID;
  broadcastId: string;
  broadcasterPartyId?: ID | null;
}): Promise<EventLiveBroadcast> {
  const endedAt = new Date().toISOString();
  let updatedBroadcast: EventLiveBroadcast | null = null;
  const actorPartyId = normalizePartyId(input.broadcasterPartyId);

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
    throw new Error('No encontramos una transmisión activa para cerrar.');
  }

  return updatedBroadcast;
}

export async function heartbeatEventLiveBroadcast(
  input: EventLiveBroadcastHeartbeatInput,
): Promise<EventLiveBroadcast> {
  const heartbeatAt = new Date().toISOString();
  let updatedBroadcast: EventLiveBroadcast | null = null;

  await updateBroadcasts(input.eventId, (current) =>
    current.map((broadcast) => {
      if (broadcast.id !== input.broadcastId) return broadcast;
      const nextViewerCount = Math.min(
        MAX_VIEWER_COUNT,
        Math.max(0, broadcast.viewerCount + Math.trunc(input.viewerDelta ?? 0)),
      );
      updatedBroadcast = {
        ...broadcast,
        viewerCount: nextViewerCount,
        lastHeartbeatAt: heartbeatAt,
      };
      return updatedBroadcast;
    }),
  );

  if (!updatedBroadcast) {
    throw new Error('No encontramos la transmisión.');
  }

  return updatedBroadcast;
}
