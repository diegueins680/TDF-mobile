import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import { normalizePartyId } from './identity';
import type {
  EventMoment,
  EventMomentActor,
  EventMomentComment,
  EventMomentCommentInput,
  EventMomentCreateInput,
  ID,
} from '../types';

const STORAGE_KEY = 'tdf-event-moments';
const MAX_CAPTION_LENGTH = 280;
const MAX_COMMENT_LENGTH = 500;
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EventMomentMediaSchema = z.object({
  kind: z.enum(['image', 'video']),
  uri: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
});

const EventMomentCommentSchema = z.object({
  id: z.string().trim().min(1),
  authorName: z.string().trim().min(1),
  authorPartyId: z.string().trim().min(1).nullable().optional(),
  body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
  createdAt: z.string().trim().min(1),
});

const EventMomentSchema = z.object({
  id: z.string().trim().min(1),
  eventId: z.string().trim().min(1),
  authorName: z.string().trim().min(1),
  authorPartyId: z.string().trim().min(1).nullable().optional(),
  caption: z.string().trim().max(MAX_CAPTION_LENGTH).nullable().optional(),
  media: EventMomentMediaSchema,
  createdAt: z.string().trim().min(1),
  reactions: z.record(z.string(), z.array(z.unknown())),
  comments: z.array(z.unknown()).optional(),
});

const EventMomentStoreSchema = z.record(z.string(), z.array(z.unknown()));

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

const normalizeReactionActors = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const actors: string[] = [];
  value.forEach((entry) => {
    const normalized = normalizeText(entry);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    actors.push(normalized);
  });
  return actors;
};

const createLocalId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const sortMomentsNewestFirst = (moments: EventMoment[]): EventMoment[] =>
  [...moments].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

const sortCommentsNewestFirst = (comments: EventMomentComment[]): EventMomentComment[] =>
  [...comments].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

const sanitizeComment = (comment: unknown): EventMomentComment | null => {
  const parsed = EventMomentCommentSchema.safeParse(comment);
  if (!parsed.success) return null;

  const createdAt = normalizeTimestamp(parsed.data.createdAt);
  if (!createdAt) return null;

  return {
    id: parsed.data.id,
    authorName: parsed.data.authorName,
    authorPartyId: normalizePartyId(parsed.data.authorPartyId),
    body: parsed.data.body.trim(),
    createdAt,
  };
};

const sanitizeMoment = (moment: unknown): EventMoment | null => {
  const parsed = EventMomentSchema.safeParse(moment);
  if (!parsed.success) return null;

  const eventId = normalizeEventId(parsed.data.eventId);
  const createdAt = normalizeTimestamp(parsed.data.createdAt);
  if (!eventId || !createdAt) return null;

  return {
    id: parsed.data.id,
    eventId,
    authorName: parsed.data.authorName.trim(),
    authorPartyId: normalizePartyId(parsed.data.authorPartyId),
    caption: normalizeText(parsed.data.caption),
    media: {
      kind: parsed.data.media.kind,
      uri: parsed.data.media.uri.trim(),
      mimeType: parsed.data.media.mimeType.trim(),
      width: parsed.data.media.width ?? null,
      height: parsed.data.media.height ?? null,
      durationMs: parsed.data.media.durationMs ?? null,
    },
    createdAt,
    reactions: Object.fromEntries(
      Object.entries(parsed.data.reactions).flatMap(([reactionTypeId, actors]) => {
        const normalizedId = normalizeText(reactionTypeId)?.toLowerCase();
        return normalizedId && CANONICAL_UUID.test(normalizedId)
          ? [[normalizedId, normalizeReactionActors(actors)]]
          : [];
      }),
    ),
    comments: sortCommentsNewestFirst(
      (parsed.data.comments ?? [])
        .map((comment) => sanitizeComment(comment))
        .filter((comment): comment is EventMomentComment => Boolean(comment)),
    ),
  };
};

const sanitizeStore = (store: unknown): Record<string, EventMoment[]> => {
  const parsed = EventMomentStoreSchema.safeParse(store);
  if (!parsed.success) return {};

  return Object.fromEntries(
    Object.entries(parsed.data)
      .map(([eventId, moments]) => {
        const normalizedEventId = normalizeEventId(eventId);
        if (!normalizedEventId) return null;

        const sanitizedMoments = sortMomentsNewestFirst(
          moments
            .map((moment) => sanitizeMoment(moment))
            .filter((moment): moment is EventMoment => Boolean(moment) && normalizeEventId(moment.eventId) === normalizedEventId),
        );

        return sanitizedMoments.length > 0 ? [normalizedEventId, sanitizedMoments] : null;
      })
      .filter((entry): entry is [string, EventMoment[]] => Boolean(entry)),
  );
};

async function readStore(): Promise<Record<string, EventMoment[]>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitizeStore(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

async function writeStore(store: Record<string, EventMoment[]>): Promise<void> {
  try {
    const entries = Object.entries(store).filter(([, moments]) => moments.length > 0);
    if (entries.length === 0) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Ignore write failures so the UI can keep responding.
  }
}

async function updateMoments(
  rawEventId: ID,
  updater: (current: EventMoment[]) => EventMoment[],
): Promise<EventMoment[]> {
  const eventId = normalizeEventId(rawEventId);
  if (!eventId) return [];

  const store = await readStore();
  const nextMoments = sortMomentsNewestFirst(updater(store[eventId] ?? []).map((moment) => sanitizeMoment(moment)).filter((moment): moment is EventMoment => Boolean(moment)));
  const nextStore = { ...store };

  if (nextMoments.length === 0) {
    delete nextStore[eventId];
  } else {
    nextStore[eventId] = nextMoments;
  }

  await writeStore(nextStore);
  return nextStore[eventId] ?? [];
}

export function buildMomentActor(input: {
  partyId?: ID | null;
  displayName?: string | null;
}): EventMomentActor {
  const partyId = normalizePartyId(input.partyId);
  const displayName = normalizeText(input.displayName) ?? (partyId ? `Party #${partyId}` : 'Invitado');
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return {
    actorKey: partyId ? `party:${partyId}` : `guest:${slug || 'anon'}`,
    displayName,
    partyId,
  };
}

export function countMomentReactions(moment: EventMoment): number {
  return Object.values(moment.reactions).reduce((total, actors) => total + actors.length, 0);
}

export function getMomentTopReaction(moment: EventMoment): string | null {
  let winningReaction: string | null = null;
  let winningCount = 0;

  Object.entries(moment.reactions).forEach(([reaction, actors]) => {
    const count = actors.length;
    if (count > winningCount) {
      winningReaction = reaction;
      winningCount = count;
    }
  });

  return winningReaction;
}

export function scoreMoment(moment: EventMoment, now = Date.now()): number {
  const recencyBoostHours = Math.max(0, 72 - (now - Date.parse(moment.createdAt)) / 36e5);
  return countMomentReactions(moment) * 4 + moment.comments.length * 6 + recencyBoostHours;
}

export function listFeaturedMoments(moments: EventMoment[], limit = 3): EventMoment[] {
  return [...moments]
    .sort((left, right) => {
      const scoreDelta = scoreMoment(right) - scoreMoment(left);
      if (scoreDelta !== 0) return scoreDelta;
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    })
    .slice(0, Math.max(0, limit));
}

export async function listEventMoments(eventId: ID): Promise<EventMoment[]> {
  const normalized = normalizeEventId(eventId);
  if (!normalized) return [];
  const store = await readStore();
  return store[normalized] ?? [];
}

export async function createEventMoment(input: EventMomentCreateInput): Promise<EventMoment> {
  const eventId = normalizeEventId(input.eventId);
  const authorName = normalizeText(input.authorName);
  const mediaUri = normalizeText(input.media.uri);
  const mediaMimeType = normalizeText(input.media.mimeType);
  if (!eventId) throw new Error('Evento inválido para publicar un momento.');
  if (!authorName) throw new Error('Agrega un nombre para publicar tu momento.');
  if (!mediaUri || !mediaMimeType) throw new Error('Selecciona una imagen o video válido.');

  const caption = normalizeText(input.caption);
  if (caption && caption.length > MAX_CAPTION_LENGTH) {
    throw new Error(`La descripción no puede exceder ${MAX_CAPTION_LENGTH} caracteres.`);
  }

  const createdAt = new Date().toISOString();
  const moment: EventMoment = {
    id: createLocalId('moment'),
    eventId,
    authorName,
    authorPartyId: normalizePartyId(input.authorPartyId),
    caption,
    media: {
      kind: input.media.kind,
      uri: mediaUri,
      mimeType: mediaMimeType,
      width: input.media.width ?? null,
      height: input.media.height ?? null,
      durationMs: input.media.durationMs ?? null,
    },
    createdAt,
    reactions: {},
    comments: [],
  };

  await updateMoments(eventId, (current) => [moment, ...current]);
  return moment;
}

export async function toggleMomentReaction(input: {
  eventId: ID;
  momentId: string;
  actorKey: string;
  reactionTypeId: string;
}): Promise<EventMoment[]> {
  const actorKey = normalizeText(input.actorKey);
  const reactionTypeId = normalizeText(input.reactionTypeId)?.toLowerCase();
  if (!actorKey) throw new Error('Necesitas una identidad para reaccionar.');
  if (!reactionTypeId || !CANONICAL_UUID.test(reactionTypeId)) {
    throw new Error('Selecciona una reacción sincronizada con identidad canónica.');
  }

  return updateMoments(input.eventId, (current) =>
    current.map((moment) => {
      if (moment.id !== input.momentId) return moment;

      const alreadySelected = (moment.reactions[reactionTypeId] ?? []).includes(actorKey);
      const nextReactions = Object.fromEntries(
        Object.entries(moment.reactions).map(([reaction, actors]) => [
          reaction,
          actors.filter((candidate) => candidate !== actorKey),
        ]),
      ) as EventMoment['reactions'];

      if (!alreadySelected) {
        nextReactions[reactionTypeId] = [actorKey, ...(nextReactions[reactionTypeId] ?? [])];
      }

      return { ...moment, reactions: nextReactions };
    }),
  );
}

export async function addMomentComment(input: EventMomentCommentInput): Promise<EventMoment[]> {
  const body = normalizeText(input.body);
  const authorName = normalizeText(input.authorName);
  if (!body) throw new Error('Escribe un comentario antes de enviarlo.');
  if (body.length > MAX_COMMENT_LENGTH) {
    throw new Error(`El comentario no puede exceder ${MAX_COMMENT_LENGTH} caracteres.`);
  }
  if (!authorName) throw new Error('Agrega un nombre para comentar.');

  const comment: EventMomentComment = {
    id: createLocalId('comment'),
    authorName,
    authorPartyId: normalizePartyId(input.authorPartyId),
    body,
    createdAt: new Date().toISOString(),
  };

  return updateMoments(input.eventId, (current) =>
    current.map((moment) =>
      moment.id === input.momentId
        ? { ...moment, comments: sortCommentsNewestFirst([comment, ...moment.comments]) }
        : moment,
    ),
  );
}
