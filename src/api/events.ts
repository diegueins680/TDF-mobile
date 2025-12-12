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
  eventTitle: string;
  eventDescription?: string | null;
  eventStart: string;
  eventEnd: string;
  eventVenueId?: string | null;
  eventPriceCents?: number | null;
  eventCapacity?: number | null;
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

/**
 * Social Events API - Wired to backend endpoints
 * Maps backend EventDTO to frontend SocialEvent types
 */
export const Events = {
  // Event CRUD
  list: async (filters?: { city?: string; startAfter?: string; upcomingOnly?: boolean; limit?: number; offset?: number }): Promise<SocialEvent[]> => {
    const query = new URLSearchParams();
    if (filters?.city) query.append('city', filters.city);
    if (filters?.startAfter) query.append('start_after', filters.startAfter);
    if (filters?.upcomingOnly && !filters.startAfter) {
      query.append('start_after', new Date().toISOString());
    }
    if (filters?.limit) query.append('limit', filters.limit.toString());
    if (filters?.offset) query.append('offset', filters.offset.toString());

    const url = `/events${query.toString() ? `?${query.toString()}` : ''}`;
    const events = await get<BackendEventDTO[]>(url);
    return events.map((e) => mapBackendEventToFrontend(e));
  },

  getById: async (eventId: ID): Promise<SocialEvent> => {
    const event = await get<BackendEventDTO>(`/events/${eventId}`);
    return mapBackendEventToFrontend(event);
  },

  create: async (body: SocialEventCreate): Promise<SocialEvent> => {
    const backendBody = mapFrontendEventToBackend(body);
    const event = await post<BackendEventDTO>('/events', backendBody);
    return mapBackendEventToFrontend(event);
  },

  update: async (eventId: ID, body: SocialEventUpdate): Promise<SocialEvent> => {
    const backendBody = mapFrontendEventToBackend(body);
    const event = await put<BackendEventDTO>(`/events/${eventId}`, backendBody);
    return mapBackendEventToFrontend(event);
  },

  delete: async (eventId: ID): Promise<void> => {
    await del<void>(`/events/${eventId}`);
  },

  // RSVP management
  getRSVPs: async (eventId: ID): Promise<EventRSVP[]> => {
    const rsvps = await get<BackendRsvpDTO[]>(`/events/${eventId}/rsvps`);
    return rsvps.map((dto) => mapRsvpDto(dto, eventId));
  },

  rsvp: async (body: EventRSVPCreate): Promise<EventRSVP> => {
    const payload = {
      rsvpEventId: String(body.eventId),
      rsvpPartyId: String(body.userId),
      rsvpStatus: mapFrontendRsvpStatus(body.status)
    };
    const result = await post<BackendRsvpDTO>(`/events/${body.eventId}/rsvps`, payload);
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
    const dto = await post<BackendInvitationDTO>(`/events/${body.eventId}/invitations`, payload);
    return mapInvitationDto(dto, body.eventId);
  },

  getInvitations: async (eventId: ID): Promise<EventInvitation[]> => {
    const list = await get<BackendInvitationDTO[]>(`/events/${eventId}/invitations`);
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
    const dto = await put<BackendInvitationDTO>(`/events/${eventId}/invitations/${invitationId}`, payload);
    return mapInvitationDto(dto, eventId);
  }
};

// Mapping functions to convert between backend EventDTO and frontend SocialEvent
function mapBackendEventToFrontend(e: BackendEventDTO): SocialEvent {
  const artists = (e.eventArtists ?? []).map((artist) => mapBackendArtistToFrontend(artist));
  return {
    id: e.eventId,
    title: e.eventTitle,
    description: e.eventDescription || null,
    startTime: e.eventStart, // ISO string from backend
    endTime: e.eventEnd,     // ISO string from backend
    venueId: e.eventVenueId ? parseInt(e.eventVenueId, 10) : 0,
    venue: undefined,
    artistIds: artists.map((a) => a.id),
    artists,
    createdBy: 0, // backend doesn't track organizer yet
    ticketPrice: e.eventPriceCents ? e.eventPriceCents / 100 : null,
    ticketUrl: null, // backend doesn't store ticket URL
    imageUrl: null,  // backend doesn't store image URL
    isPublic: true,  // backend doesn't track visibility
    rsvpCount: Array.isArray(e.eventRsvps) ? e.eventRsvps.length : 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function mapFrontendEventToBackend(body: SocialEventCreate | SocialEventUpdate) {
  return {
    eventTitle: body.title,
    eventDescription: body.description,
    eventStart: body.startTime,
    eventEnd: body.endTime,
    eventVenueId: body.venueId?.toString(),
    eventPriceCents: body.ticketPrice ? Math.round(body.ticketPrice * 100) : null,
    eventCapacity: null,
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
