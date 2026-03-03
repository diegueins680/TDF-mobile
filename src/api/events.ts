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

const normalizeVenueId = (value?: string | null): ID => {
  const trimmed = value?.trim();
  if (!trimmed) return 0;
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return trimmed;
};

const normalizePartyId = (value?: ID | null): ID => {
  if (typeof value === 'number') return value;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return 0;
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return trimmed;
};

const normalizeVenueLookupId = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? String(Number.parseInt(trimmed, 10)) : trimmed;
};

async function loadVenueMapByIds(rawVenueIds: Array<string | null | undefined>) {
  const uniqueVenueIds = [...new Set(rawVenueIds.map((value) => normalizeVenueLookupId(value)).filter((value): value is string => Boolean(value)))];
  if (uniqueVenueIds.length === 0) return new Map<string, Awaited<ReturnType<typeof Venues.getById>>>();

  const settled = await Promise.allSettled(uniqueVenueIds.map((venueId) => Venues.getById(venueId)));
  const map = new Map<string, Awaited<ReturnType<typeof Venues.getById>>>();
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      map.set(String(result.value.id), result.value);
    }
    if (result.status === 'rejected') {
      const fallbackId = uniqueVenueIds[index];
      if (fallbackId) {
        map.delete(String(fallbackId));
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
    if (filters?.city) query.append('city', filters.city);
    if (filters?.startAfter) query.append('start_after', filters.startAfter);
    if (filters?.upcomingOnly && !filters.startAfter) {
      query.append('start_after', new Date().toISOString());
    }
    if (filters?.limit) query.append('limit', filters.limit.toString());
    if (filters?.offset) query.append('offset', filters.offset.toString());
    if (filters?.artistId != null) query.append('artistId', String(filters.artistId));
    if (filters?.venueId != null) query.append('venueId', String(filters.venueId));

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
    const backendBody = mapFrontendEventToBackend(body);
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
    const payload = {
      rsvpEventId: String(body.eventId),
      rsvpPartyId: String(body.userId),
      rsvpStatus: mapFrontendRsvpStatus(body.status)
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
    const payload = {
      invitationEventId: String(body.eventId),
      invitationFromPartyId: body.fromUserId ? String(body.fromUserId) : undefined,
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
    const payload = {
      invitationStatus: status,
      invitationMessage: message ?? undefined
    };
    // Backend expects PATCH for updating invitation status
    const dto = await put<BackendInvitationDTO>(`/social-events/events/${eventId}/invitations/${invitationId}`, payload);
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
    ticketPrice: typeof e.eventPriceCents === 'number' ? e.eventPriceCents / 100 : null,
    ticketUrl: e.eventTicketUrl ?? null,
    imageUrl: e.eventImageUrl ?? null,
    isPublic: typeof e.eventIsPublic === 'boolean' ? e.eventIsPublic : true,
    rsvpCount: Array.isArray(e.eventRsvps) ? e.eventRsvps.length : 0,
    createdAt: e.eventCreatedAt ?? nowIso,
    updatedAt: e.eventUpdatedAt ?? e.eventCreatedAt ?? nowIso
  };
}

function mapFrontendEventToBackend(body: SocialEventCreate | SocialEventUpdate) {
  return {
    eventTitle: body.title,
    eventDescription: body.description,
    eventStart: body.startTime,
    eventEnd: body.endTime,
    eventVenueId: body.venueId?.toString(),
    eventPriceCents: typeof body.ticketPrice === 'number' ? Math.round(body.ticketPrice * 100) : null,
    eventCapacity: null,
    eventTicketUrl: body.ticketUrl ?? null,
    eventImageUrl: body.imageUrl ?? null,
    eventIsPublic: body.isPublic,
    eventArtists: body.artistIds?.map((id: ID) => ({ artistId: id })) || []
  };
}

function mapRsvpDto(dto: BackendRsvpDTO, fallbackEventId: ID, fallbackPartyId?: ID): EventRSVP {
  return {
    id: dto.rsvpId ?? `${dto.rsvpPartyId}-${dto.rsvpEventId ?? fallbackEventId}`,
    eventId: dto.rsvpEventId ?? fallbackEventId,
    userId: dto.rsvpPartyId ?? fallbackPartyId ?? '',
    status: mapBackendRsvpStatus(dto.rsvpStatus),
    createdAt: dto.rsvpCreatedAt || new Date().toISOString(),
    updatedAt: dto.rsvpUpdatedAt || dto.rsvpCreatedAt || new Date().toISOString()
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

function mapFrontendRsvpStatus(status: RSVPStatus): string {
  switch (status) {
    case 'GOING':
      return 'Accepted';
    case 'INTERESTED':
      return 'Maybe';
    case 'NOT_GOING':
      return 'Declined';
    default:
      return 'Maybe';
  }
}

function mapInvitationStatus(raw: unknown): EventInvitationStatus {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'accepted') return 'ACCEPTED';
  if (normalized === 'declined') return 'DECLINED';
  return 'PENDING';
}

function mapInvitationDto(dto: BackendInvitationDTO, fallbackEventId: ID): EventInvitation {
  return {
    id: dto.invitationId ?? `${dto.invitationToPartyId}-${dto.invitationEventId ?? fallbackEventId}`,
    eventId: dto.invitationEventId ?? fallbackEventId,
    fromUserId: dto.invitationFromPartyId ?? null,
    toUserId: dto.invitationToPartyId,
    status: mapInvitationStatus(dto.invitationStatus),
    message: dto.invitationMessage ?? null,
    createdAt: dto.invitationCreatedAt || new Date().toISOString(),
    updatedAt: dto.invitationUpdatedAt || dto.invitationCreatedAt || null
  };
}
