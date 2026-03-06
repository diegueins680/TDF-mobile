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
  RSVPStatus,
  EventInvitationStatus,
  ArtistSocialLinks
} from '../types';
import { normalizeOptionalTimestamp } from '../lib/isoDate';
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

    const payload = {
      rsvpEventId: String(body.eventId),
      rsvpPartyId: String(body.userId),
      rsvpStatus: backendStatus
    };
    const result = await post<BackendRsvpDTO>(`/social-events/events/${body.eventId}/rsvps`, payload);
    return mapRsvpDto(result, body.eventId, body.userId);
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
    rsvpCount: Array.isArray(e.eventRsvps) ? e.eventRsvps.length : 0,
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

function mapFrontendEventToBackend(body: SocialEventCreate) {
  return {
    eventTitle: body.title,
    eventDescription: body.description,
    eventStart: body.startTime,
    eventEnd: body.endTime,
    eventVenueId: normalizeBackendVenueId(body.venueId),
    eventPriceCents: typeof body.ticketPrice === 'number' ? Math.round(body.ticketPrice * 100) : null,
    eventCapacity: null,
    eventTicketUrl: body.ticketUrl ?? null,
    eventImageUrl: body.imageUrl ?? null,
    eventIsPublic: body.isPublic,
    eventArtists: body.artistIds?.map((id: ID) => ({ artistId: id })) || []
  };
}

function mergeEventUpdate(existing: SocialEvent, patch: SocialEventUpdate): SocialEventCreate {
  return {
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description ?? undefined,
    startTime: patch.startTime ?? existing.startTime,
    endTime: patch.endTime ?? existing.endTime,
    venueId: patch.venueId ?? existing.venueId,
    artistIds: patch.artistIds ?? existing.artistIds,
    ticketPrice: patch.ticketPrice ?? existing.ticketPrice ?? undefined,
    ticketUrl: patch.ticketUrl ?? existing.ticketUrl ?? undefined,
    imageUrl: patch.imageUrl ?? existing.imageUrl ?? undefined,
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
    status: mapBackendRsvpStatus(dto.rsvpStatus),
    createdAt,
    updatedAt
  };
}

function mapBackendRsvpStatus(raw: unknown): RSVPStatus {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'accepted' || normalized === 'going' || normalized === 'yes') return 'GOING';
  if (normalized === 'maybe' || normalized === 'interested') return 'INTERESTED';
  if (normalized === 'declined' || normalized === 'not_going' || normalized === 'not-going' || normalized === 'no') {
    return 'NOT_GOING';
  }
  return 'NONE';
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
    default:
      return null;
  }
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
