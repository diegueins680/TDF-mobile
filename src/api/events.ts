import { del, get, post, put } from './client';
import type {
  ID,
  SocialEvent,
  SocialEventCreate,
  SocialEventUpdate,
  EventRSVP,
  EventRSVPCreate,
  EventInvitation,
  EventInvitationCreate,
  EventMoment,
  EventMomentComment,
  EventMomentCommentInput,
  EventMomentCreateInput,
  EventMomentReactionKind,
  RSVPStatus,
  EventInvitationStatus,
  ArtistSocialLinks
} from '../types';
import { assertNever } from '../lib/assertNever';
import { normalizePartyId as normalizeIdentityPartyId } from '../lib/identity';
import { normalizeOptionalTimestamp } from '../lib/isoDate';
import { normalizeRsvpStatus } from '../lib/rsvp';
import { mapBackendArtistToFrontend } from './artists';
import { Venues } from './venues';

type BackendArtistDTO = {
  artistId?: ID;
  id?: ID;
  artistName?: string;
  artistGenres?: string[];
  artistBio?: string | null;
  artistAvatarUrl?: string | null;
  artistSocialLinks?: ArtistSocialLinks;
};

type BackendEventDTO = {
  eventId: ID;
  eventOrganizerPartyId?: ID | null;
  eventTitle: string;
  eventDescription?: string | null;
  eventStart: string;
  eventEnd: string;
  eventVenueId?: string | null;
  eventPriceCents?: number | null;
  eventCapacity?: number | null;
  eventTicketUrl?: string | null;
  eventImageUrl?: string | null;
  eventIsPublic?: boolean | null;
  eventCreatedAt?: string | null;
  eventUpdatedAt?: string | null;
  eventArtists?: BackendArtistDTO[];
  eventRsvps?: BackendRsvpDTO[];
};

type BackendRsvpDTO = {
  rsvpId?: ID;
  rsvpEventId?: ID;
  rsvpPartyId?: ID;
  rsvpStatus?: string;
  rsvpCreatedAt?: string;
  rsvpUpdatedAt?: string;
};

type BackendInvitationDTO = {
  invitationId?: ID;
  invitationEventId?: ID;
  invitationFromPartyId?: ID | null;
  invitationToPartyId: ID;
  invitationStatus?: string | null;
  invitationMessage?: string | null;
  invitationCreatedAt?: string;
  invitationUpdatedAt?: string;
};

type BackendMomentReactionDTO = {
  emrReaction?: string | null;
  emrPartyId?: ID | null;
  emrCreatedAt?: string | null;
};

type BackendMomentCommentDTO = {
  emcId?: ID | null;
  emcMomentId?: ID | null;
  emcAuthorPartyId?: ID | null;
  emcAuthorName?: string | null;
  emcBody?: string | null;
  emcCreatedAt?: string | null;
  emcUpdatedAt?: string | null;
};

type BackendMomentDTO = {
  emId?: ID | null;
  emEventId?: ID | null;
  emAuthorPartyId?: ID | null;
  emAuthorName?: string | null;
  emCaption?: string | null;
  emMediaUrl?: string | null;
  emMediaType?: string | null;
  emMediaWidth?: number | null;
  emMediaHeight?: number | null;
  emMediaDurationMs?: number | null;
  emCreatedAt?: string | null;
  emUpdatedAt?: string | null;
  emReactions?: BackendMomentReactionDTO[];
  emComments?: BackendMomentCommentDTO[];
};

type SocialEventWrite = Omit<SocialEventCreate, 'description' | 'venueId' | 'ticketPrice' | 'ticketUrl' | 'imageUrl'> & {
  description?: string | null;
  venueId: ID | null;
  ticketPrice?: number | null;
  ticketUrl?: string | null;
  imageUrl?: string | null;
};

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const parseSafeInteger = (value: string): number | null => {
  if (!/^-?\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const normalizeComparableId = (value: ID): string | null => {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return String(value);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? String(parsed) : null;
  return trimmed;
};

const normalizeVenueId = (value?: string | null): ID => {
  const trimmed = value?.trim();
  if (!trimmed) return 0;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? parsed : 0;
  return trimmed;
};

const normalizePartyId = (value?: ID | null): ID => {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return 0;
    return value;
  }
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return 0;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? parsed : 0;
  return trimmed;
};

const normalizeVenueLookupId = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? String(parsed) : null;
  return trimmed;
};

const normalizeOptionalIdParam = (value: ID | null | undefined): string | null => {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return String(value);
  }
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed >= 0 ? String(parsed) : null;
  return trimmed;
};

const normalizeOptionalPositiveIdParam = (value: ID | null | undefined): string | null => {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return String(value);
  }
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? String(parsed) : null;
  return trimmed;
};

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeMomentMediaKind = (value: string | null | undefined): 'image' | 'video' => {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'video' ? 'video' : 'image';
};

const normalizeMomentReactionKind = (value: string | null | undefined): EventMomentReactionKind | null => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'fire' || normalized === 'love' || normalized === 'applause') {
    return normalized;
  }
  return null;
};

const normalizeBackendVenueId = (value: ID | null | undefined): string | null => {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return String(value);
  }
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? String(parsed) : null;
  return trimmed;
};

async function loadVenueMapByIds(rawVenueIds: Array<string | null | undefined>) {
  const uniqueVenueIds = [...new Set(rawVenueIds.map((value) => normalizeVenueLookupId(value)).filter((value): value is string => Boolean(value)))];
  if (uniqueVenueIds.length === 0) return new Map<string, Awaited<ReturnType<typeof Venues.getById>>>();

  const settled = await Promise.allSettled(uniqueVenueIds.map((venueId) => Venues.getById(venueId)));
  const map = new Map<string, Awaited<ReturnType<typeof Venues.getById>>>();
  settled.forEach((result, index) => {
    const requestedId = uniqueVenueIds[index];
    if (result.status === 'fulfilled') {
      if (requestedId) {
        // Keep lookup stable when backend canonicalizes venue IDs.
        map.set(String(requestedId), result.value);
      }
      map.set(String(result.value.id), result.value);
    }
    if (result.status === 'rejected') {
      if (requestedId) {
        map.delete(String(requestedId));
      }
    }
  });
  return map;
}

/**
 * Social Events API - Wired to backend endpoints
 * Maps backend EventDTO to frontend SocialEvent types
 */
export const Events = {
  // Event CRUD
  list: async (filters?: {
    city?: string;
    startAfter?: string;
    upcomingOnly?: boolean;
    limit?: number;
    offset?: number;
    artistId?: ID;
    venueId?: ID;
  }): Promise<SocialEvent[]> => {
    const query = new URLSearchParams();
    const city = filters?.city?.trim();
    const startAfter = filters?.startAfter?.trim();
    if (city) query.append('city', city);
    if (startAfter) query.append('start_after', startAfter);
    if (filters?.upcomingOnly && !startAfter) {
      query.append('start_after', new Date().toISOString());
    }
    if (typeof filters?.limit === 'number' && Number.isFinite(filters.limit)) {
      const normalizedLimit = Math.trunc(filters.limit);
      if (normalizedLimit > 0) {
        query.append('limit', String(normalizedLimit));
      }
    }
    if (typeof filters?.offset === 'number' && Number.isFinite(filters.offset)) {
      const normalizedOffset = Math.trunc(filters.offset);
      if (normalizedOffset >= 0) {
        query.append('offset', String(normalizedOffset));
      }
    }
    const artistId = normalizeOptionalPositiveIdParam(filters?.artistId);
    const venueId = normalizeOptionalPositiveIdParam(filters?.venueId);
    if (artistId) query.append('artistId', artistId);
    if (venueId) query.append('venueId', venueId);

    const url = `/social-events/events${query.toString() ? `?${query.toString()}` : ''}`;
    const events = await get<BackendEventDTO[]>(url);
    const venueMap = await loadVenueMapByIds(events.map((event) => event.eventVenueId));
    return events.map((event) =>
      mapBackendEventToFrontend(event, venueMap.get(String(normalizeVenueId(event.eventVenueId))))
    );
  },

  getById: async (eventId: ID): Promise<SocialEvent> => {
    const event = await get<BackendEventDTO>(`/social-events/events/${eventId}`);
    const venueMap = await loadVenueMapByIds([event.eventVenueId]);
    return mapBackendEventToFrontend(event, venueMap.get(String(normalizeVenueId(event.eventVenueId))));
  },

  create: async (body: SocialEventCreate): Promise<SocialEvent> => {
    assertValidTicketPriceForCreate(body.ticketPrice);
    const backendBody = mapFrontendEventToBackend(body);
    const event = await post<BackendEventDTO>('/social-events/events', backendBody);
    return mapBackendEventToFrontend(event);
  },

  update: async (eventId: ID, body: SocialEventUpdate): Promise<SocialEvent> => {
    const existing = await Events.getById(eventId);
    const backendBody = mapFrontendEventToBackend(mergeEventUpdate(existing, body));
    const event = await put<BackendEventDTO>(`/social-events/events/${eventId}`, backendBody);
    return mapBackendEventToFrontend(event);
  },

  delete: async (eventId: ID): Promise<void> => {
    await del<void>(`/social-events/events/${eventId}`);
  },

  // RSVP management
  getRSVPs: async (eventId: ID): Promise<EventRSVP[]> => {
    const rsvps = await get<BackendRsvpDTO[]>(`/social-events/events/${eventId}/rsvps`);
    return rsvps.map((dto) => mapRsvpDto(dto, eventId));
  },

  rsvp: async (body: EventRSVPCreate): Promise<EventRSVP> => {
    const backendStatus = mapFrontendRsvpStatus(body.status);
    if (!backendStatus) {
      throw new Error('RSVP status NONE cannot be submitted.');
    }
    const normalizedPartyId = normalizeIdentityPartyId(body.userId);
    if (!normalizedPartyId) {
      throw new Error('Party ID inválido para RSVP.');
    }

    const payload = {
      rsvpEventId: String(body.eventId),
      rsvpPartyId: normalizedPartyId,
      rsvpStatus: backendStatus
    };
    const result = await post<BackendRsvpDTO>(`/social-events/events/${body.eventId}/rsvps`, payload);
    return mapRsvpDto(result, body.eventId, normalizedPartyId);
  },

  updateRSVP: async (body: EventRSVPCreate): Promise<EventRSVP> => {
    // Backend upserts RSVPs on POST, so reuse the same endpoint.
    return Events.rsvp(body);
  },

  // Invitations
  sendInvitation: async (body: EventInvitationCreate): Promise<EventInvitation> => {
    const fromPartyId = normalizeOptionalIdParam(body.fromUserId);
    const payload = {
      invitationEventId: String(body.eventId),
      invitationFromPartyId: fromPartyId ?? undefined,
      invitationToPartyId: String(body.toUserId),
      invitationStatus: body.status ?? 'PENDING',
      invitationMessage: body.message ?? null
    };
    const dto = await post<BackendInvitationDTO>(`/social-events/events/${body.eventId}/invitations`, payload);
    return mapInvitationDto(dto, body.eventId);
  },

  getInvitations: async (eventId: ID): Promise<EventInvitation[]> => {
    const list = await get<BackendInvitationDTO[]>(`/social-events/events/${eventId}/invitations`);
    return list.map((dto) => mapInvitationDto(dto, eventId));
  },

  respondToInvitation: async (
    eventId: ID,
    invitationId: ID,
    status: EventInvitationStatus,
    message?: string
  ): Promise<EventInvitation> => {
    const invitationIdKey = normalizeComparableId(invitationId);
    if (!invitationIdKey) {
      throw new Error('Invalid invitation id.');
    }
    const invitation = (await Events.getInvitations(eventId)).find(
      (item) => normalizeComparableId(item.id) === invitationIdKey,
    );
    if (!invitation) {
      throw new Error(`Invitation ${invitationIdKey} not found for event ${String(eventId)}.`);
    }

    const payload = {
      invitationToPartyId: String(invitation.toUserId),
      invitationStatus: status,
      invitationMessage: message ?? undefined
    };
    // Backend endpoint updates invitation status via PUT.
    const invitationPathId = encodeURIComponent(invitationIdKey);
    const dto = await put<BackendInvitationDTO>(
      `/social-events/events/${eventId}/invitations/${invitationPathId}`,
      payload
    );
    return mapInvitationDto(dto, eventId);
  },

  // Event moments
  listMoments: async (eventId: ID): Promise<EventMoment[]> => {
    const list = await get<BackendMomentDTO[]>(`/social-events/events/${eventId}/moments`);
    return list.map((dto, index) => mapMomentDto(dto, eventId, index));
  },

  createMoment: async (input: EventMomentCreateInput): Promise<EventMoment> => {
    const payload = {
      emCreateAuthorName: input.authorName,
      emCreateCaption: input.caption ?? null,
      emCreateMediaUrl: input.media.uri,
      emCreateMediaType: input.media.kind,
      emCreateMediaWidth: input.media.width ?? null,
      emCreateMediaHeight: input.media.height ?? null,
      emCreateMediaDurationMs: input.media.durationMs ?? null,
    };
    const dto = await post<BackendMomentDTO>(`/social-events/events/${input.eventId}/moments`, payload);
    return mapMomentDto(dto, input.eventId);
  },

  reactToMoment: async (
    eventId: ID,
    momentId: string,
    reaction: EventMomentReactionKind,
  ): Promise<EventMoment> => {
    const dto = await post<BackendMomentDTO>(
      `/social-events/events/${eventId}/moments/${encodeURIComponent(momentId)}/reactions`,
      { emrrReaction: reaction },
    );
    return mapMomentDto(dto, eventId);
  },

  commentOnMoment: async (input: EventMomentCommentInput): Promise<EventMomentComment> => {
    const dto = await post<BackendMomentCommentDTO>(
      `/social-events/events/${input.eventId}/moments/${encodeURIComponent(input.momentId)}/comments`,
      {
        emccAuthorName: input.authorName,
        emccBody: input.body,
      },
    );
    return mapMomentCommentDto(dto, input.momentId);
  }
};

// Mapping functions to convert between backend EventDTO and frontend SocialEvent
function mapBackendEventToFrontend(
  e: BackendEventDTO,
  venueOverride?: SocialEvent['venue']
): SocialEvent {
  const nowIso = new Date().toISOString();
  const artists = (e.eventArtists ?? []).map((artist) => mapBackendArtistToFrontend(artist));
  const createdAt = normalizeOptionalTimestamp(e.eventCreatedAt) ?? nowIso;
  const updatedAt = normalizeOptionalTimestamp(e.eventUpdatedAt) ?? createdAt;
  return {
    id: e.eventId,
    title: e.eventTitle,
    description: e.eventDescription || null,
    startTime: e.eventStart, // ISO string from backend
    endTime: e.eventEnd,     // ISO string from backend
    venueId: normalizeVenueId(e.eventVenueId),
    venue: venueOverride,
    artistIds: artists.map((a) => a.id),
    artists,
    createdBy: normalizePartyId(e.eventOrganizerPartyId),
    ticketPrice: normalizeTicketPrice(e.eventPriceCents),
    ticketUrl: e.eventTicketUrl ?? null,
    imageUrl: e.eventImageUrl ?? null,
    isPublic: typeof e.eventIsPublic === 'boolean' ? e.eventIsPublic : true,
    rsvpCount: Array.isArray(e.eventRsvps)
      ? e.eventRsvps.filter((rsvp) => normalizeRsvpStatus(rsvp.rsvpStatus) === 'GOING').length
      : 0,
    createdAt,
    updatedAt
  };
}

function normalizeTicketPrice(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value / 100;
}

function normalizeTicketPriceInput(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}

function assertValidTicketPriceForCreate(value: unknown): void {
  if (value == null) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Ticket price must be a valid number greater than or equal to zero.');
  }
}

function toBackendTicketPriceCents(value: unknown): number | null {
  const normalized = normalizeTicketPriceInput(value);
  if (normalized === undefined) return null;
  return Math.round(normalized * 100);
}

function mapFrontendEventToBackend(body: SocialEventWrite) {
  return {
    eventTitle: body.title,
    eventDescription: body.description,
    eventStart: body.startTime,
    eventEnd: body.endTime,
    eventVenueId: normalizeBackendVenueId(body.venueId),
    eventPriceCents: toBackendTicketPriceCents(body.ticketPrice),
    eventCapacity: null,
    eventTicketUrl: body.ticketUrl ?? null,
    eventImageUrl: body.imageUrl ?? null,
    eventIsPublic: body.isPublic,
    eventArtists: body.artistIds?.map((id: ID) => ({ artistId: id })) || []
  };
}

function mergeEventUpdate(existing: SocialEvent, patch: SocialEventUpdate): SocialEventWrite {
  const existingTicketPrice = normalizeTicketPriceInput(existing.ticketPrice);

  const mergedDescription = hasOwn(patch, 'description')
    ? patch.description === null
      ? undefined
      : patch.description ?? existing.description ?? undefined
    : existing.description ?? undefined;

  const mergedVenueId = hasOwn(patch, 'venueId')
    ? patch.venueId === null
      ? null
      : patch.venueId ?? existing.venueId
    : existing.venueId;

  const mergedTicketPrice = (() => {
    if (!hasOwn(patch, 'ticketPrice')) return existingTicketPrice;
    if (patch.ticketPrice === null) return undefined;
    const patchTicketPrice = normalizeTicketPriceInput(patch.ticketPrice);
    return patchTicketPrice ?? existingTicketPrice;
  })();

  const mergedTicketUrl = hasOwn(patch, 'ticketUrl')
    ? patch.ticketUrl === null
      ? undefined
      : patch.ticketUrl ?? existing.ticketUrl ?? undefined
    : existing.ticketUrl ?? undefined;

  const mergedImageUrl = hasOwn(patch, 'imageUrl')
    ? patch.imageUrl === null
      ? undefined
      : patch.imageUrl ?? existing.imageUrl ?? undefined
    : existing.imageUrl ?? undefined;

  return {
    title: patch.title ?? existing.title,
    description: mergedDescription,
    startTime: patch.startTime ?? existing.startTime,
    endTime: patch.endTime ?? existing.endTime,
    venueId: mergedVenueId,
    artistIds: patch.artistIds ?? existing.artistIds,
    ticketPrice: mergedTicketPrice,
    ticketUrl: mergedTicketUrl,
    imageUrl: mergedImageUrl,
    isPublic: patch.isPublic ?? existing.isPublic,
  };
}

function mapRsvpDto(dto: BackendRsvpDTO, fallbackEventId: ID, fallbackPartyId?: ID): EventRSVP {
  const createdAt = normalizeOptionalTimestamp(dto.rsvpCreatedAt) ?? new Date().toISOString();
  const updatedAt =
    normalizeOptionalTimestamp(dto.rsvpUpdatedAt) ??
    normalizeOptionalTimestamp(dto.rsvpCreatedAt) ??
    createdAt;
  return {
    id: dto.rsvpId ?? `${dto.rsvpPartyId}-${dto.rsvpEventId ?? fallbackEventId}`,
    eventId: dto.rsvpEventId ?? fallbackEventId,
    userId: dto.rsvpPartyId ?? fallbackPartyId ?? '',
    status: normalizeRsvpStatus(dto.rsvpStatus),
    createdAt,
    updatedAt
  };
}

function mapFrontendRsvpStatus(status: RSVPStatus): string | null {
  switch (status) {
    case 'GOING':
      return 'Accepted';
    case 'INTERESTED':
      return 'Maybe';
    case 'NOT_GOING':
      return 'Declined';
    case 'NONE':
      return null;
  }

  return assertNever(status, 'RSVP status');
}

function mapInvitationStatus(raw: unknown): EventInvitationStatus {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'accepted') return 'ACCEPTED';
  if (normalized === 'declined') return 'DECLINED';
  return 'PENDING';
}

function mapInvitationDto(dto: BackendInvitationDTO, fallbackEventId: ID): EventInvitation {
  const createdAt = normalizeOptionalTimestamp(dto.invitationCreatedAt) ?? new Date().toISOString();
  const updatedAt =
    normalizeOptionalTimestamp(dto.invitationUpdatedAt) ??
    normalizeOptionalTimestamp(dto.invitationCreatedAt) ??
    null;
  return {
    id: dto.invitationId ?? `${dto.invitationToPartyId}-${dto.invitationEventId ?? fallbackEventId}`,
    eventId: dto.invitationEventId ?? fallbackEventId,
    fromUserId: dto.invitationFromPartyId ?? null,
    toUserId: dto.invitationToPartyId,
    status: mapInvitationStatus(dto.invitationStatus),
    message: dto.invitationMessage ?? null,
    createdAt,
    updatedAt
  };
}

function mapMomentCommentDto(dto: BackendMomentCommentDTO, fallbackMomentId: ID, index = 0): EventMomentComment {
  const createdAt = normalizeOptionalTimestamp(dto.emcCreatedAt) ?? new Date().toISOString();
  const normalizedCommentId = normalizeComparableId(dto.emcId ?? null);
  return {
    id: normalizedCommentId ?? `moment-comment:${String(fallbackMomentId)}:${index}`,
    authorName: normalizeOptionalText(dto.emcAuthorName) ?? 'Invitado',
    authorPartyId: normalizeIdentityPartyId(dto.emcAuthorPartyId),
    body: normalizeOptionalText(dto.emcBody) ?? '',
    createdAt,
  };
}

function mapMomentReactions(dto: BackendMomentDTO): EventMoment['reactions'] {
  const reactions: EventMoment['reactions'] = { fire: [], love: [], applause: [] };

  (dto.emReactions ?? []).forEach((reactionDto, index) => {
    const reaction = normalizeMomentReactionKind(reactionDto.emrReaction);
    if (!reaction) return;

    const partyId = normalizeIdentityPartyId(reactionDto.emrPartyId);
    const actorKey = partyId ? `party:${partyId}` : `guest:${reaction}:${index}`;
    if (!reactions[reaction].includes(actorKey)) {
      reactions[reaction].push(actorKey);
    }
  });

  return reactions;
}

function inferMomentMimeType(kind: EventMoment['media']['kind'], mediaUrl: string): string {
  const normalizedUrl = mediaUrl.toLowerCase();
  if (kind === 'video') {
    if (normalizedUrl.endsWith('.mov')) return 'video/quicktime';
    if (normalizedUrl.endsWith('.webm')) return 'video/webm';
    return 'video/mp4';
  }

  if (normalizedUrl.endsWith('.png')) return 'image/png';
  if (normalizedUrl.endsWith('.webp')) return 'image/webp';
  if (normalizedUrl.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function mapMomentDto(dto: BackendMomentDTO, fallbackEventId: ID, index = 0): EventMoment {
  const createdAt = normalizeOptionalTimestamp(dto.emCreatedAt) ?? new Date().toISOString();
  const mediaUrl = normalizeOptionalText(dto.emMediaUrl) ?? '';
  const mediaKind = normalizeMomentMediaKind(dto.emMediaType);
  const normalizedMomentId = normalizeComparableId(dto.emId ?? null);
  const comments = (dto.emComments ?? [])
    .map((commentDto, commentIndex) => mapMomentCommentDto(commentDto, dto.emId ?? `remote:${index}`, commentIndex))
    .filter((comment) => comment.body.trim().length > 0)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  return {
    id: normalizedMomentId ?? `remote-moment:${String(fallbackEventId)}:${index}`,
    eventId: normalizeComparableId(dto.emEventId ?? fallbackEventId) ?? String(fallbackEventId),
    authorName: normalizeOptionalText(dto.emAuthorName) ?? 'Invitado',
    authorPartyId: normalizeIdentityPartyId(dto.emAuthorPartyId),
    caption: normalizeOptionalText(dto.emCaption),
    media: {
      kind: mediaKind,
      uri: mediaUrl,
      mimeType: inferMomentMimeType(mediaKind, mediaUrl),
      width: typeof dto.emMediaWidth === 'number' ? dto.emMediaWidth : null,
      height: typeof dto.emMediaHeight === 'number' ? dto.emMediaHeight : null,
      durationMs: typeof dto.emMediaDurationMs === 'number' ? dto.emMediaDurationMs : null,
    },
    createdAt,
    reactions: mapMomentReactions(dto),
    comments,
  };
}
