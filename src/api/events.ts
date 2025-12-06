import { get, post, put } from './client';
import type {
  ID,
  SocialEvent,
  SocialEventCreate,
  SocialEventUpdate,
  EventRSVP,
  EventRSVPCreate,
  EventInvitation,
  EventInvitationCreate
} from '../types';

/**
 * Social Events API - Wired to backend endpoints
 * Maps backend EventDTO to frontend SocialEvent types
 */
export const Events = {
  // Event CRUD
  list: async (filters?: { city?: string; startAfter?: string }): Promise<SocialEvent[]> => {
    const query = new URLSearchParams();
    if (filters?.city) query.append('city', filters.city);
    if (filters?.startAfter) query.append('start_after', filters.startAfter);
    
    const url = `/events${query.toString() ? '?' + query.toString() : ''}`;
    const events = await get<any[]>(url);
    return events.map(e => mapBackendEventToFrontend(e));
  },

  getById: async (eventId: ID): Promise<SocialEvent> => {
    const event = await get<any>(`/events/${eventId}`);
    return mapBackendEventToFrontend(event);
  },

  create: async (body: SocialEventCreate): Promise<SocialEvent> => {
    const backendBody = mapFrontendEventToBackend(body);
    const event = await post<any>('/events', backendBody);
    return mapBackendEventToFrontend(event);
  },

  update: async (eventId: ID, body: SocialEventUpdate): Promise<SocialEvent> => {
    const backendBody = mapFrontendEventToBackend(body);
    const event = await put<any>(`/events/${eventId}`, backendBody);
    return mapBackendEventToFrontend(event);
  },

  delete: async (eventId: ID): Promise<void> => {
    // Backend uses DELETE, not POST
    return fetch(`/events/${eventId}`, { method: 'DELETE' }).then(() => {});
  },

  // RSVP management
  getRSVPs: async (eventId: ID): Promise<EventRSVP[]> => {
    const rsvps = await get<any[]>(`/events/${eventId}/rsvps`);
    return rsvps.map(r => ({
      id: r.rsvpId ? parseInt(r.rsvpId) : 0,
      eventId: parseInt(r.rsvpEventId) || eventId,
      userId: r.rsvpPartyId as any,
      status: mapBackendRsvpStatus(r.rsvpStatus),
      createdAt: r.rsvpCreatedAt || new Date().toISOString(),
      updatedAt: r.rsvpCreatedAt || new Date().toISOString()
    }));
  },

  rsvp: async (body: EventRSVPCreate): Promise<EventRSVP> => {
    const rsvpBody = {
      rsvpEventId: String(body.eventId),
      rsvpPartyId: String(body.userId),
      rsvpStatus: mapFrontendRsvpStatus(body.status)
    };
    const result = await post<any>(`/events/${body.eventId}/rsvps`, rsvpBody);
    return {
      id: result.rsvpId ? parseInt(result.rsvpId) : 0,
      eventId: body.eventId,
      userId: body.userId,
      status: body.status,
      createdAt: result.rsvpCreatedAt || new Date().toISOString(),
      updatedAt: result.rsvpCreatedAt || new Date().toISOString()
    };
  },

  updateRSVP: async (rsvpId: ID, status: string): Promise<EventRSVP> => {
    throw new Error('Not yet implemented on backend');
  },

  // Invitations (stubs - backend not yet implemented)
  sendInvitation: async (body: EventInvitationCreate): Promise<EventInvitation> => {
    return post<EventInvitation>(`/events/${body.eventId}/invitations`, {});
  },

  getInvitations: async (userId: ID): Promise<EventInvitation[]> => {
    return [];
  },

  respondToInvitation: async (invitationId: ID, status: 'ACCEPTED' | 'DECLINED'): Promise<EventInvitation> => {
    throw new Error('Not yet implemented on backend');
  }
};

// Mapping functions to convert between backend EventDTO and frontend SocialEvent
function mapBackendEventToFrontend(e: any): SocialEvent {
  return {
    id: e.eventId,
    title: e.eventTitle,
    description: e.eventDescription || null,
    startTime: e.eventStart, // ISO string from backend
    endTime: e.eventEnd,     // ISO string from backend
    venueId: e.eventVenueId ? parseInt(e.eventVenueId) : 0,
    venue: undefined,
    artistIds: e.eventArtists?.map((a: any) => a.artistId || a.id) || [],
    artists: e.eventArtists || [],
    createdBy: 0, // backend doesn't track organizer yet
    ticketPrice: e.eventPriceCents ? e.eventPriceCents / 100 : null,
    ticketUrl: null, // backend doesn't store ticket URL
    imageUrl: null,  // backend doesn't store image URL
    isPublic: true,  // backend doesn't track visibility
    rsvpCount: 0,    // backend doesn't track RSVPs
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function mapFrontendEventToBackend(body: any) {
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

// RSVP status mapping: backend uses "Accepted|Declined|Maybe", frontend uses "GOING|INTERESTED|NOT_GOING|NONE"
function mapBackendRsvpStatus(status: string): any {
  switch (status?.toLowerCase()) {
    case 'accepted': return 'GOING';
    case 'declined': return 'NOT_GOING';
    case 'maybe': return 'INTERESTED';
    default: return 'NONE';
  }
}

function mapFrontendRsvpStatus(status: string): string {
  switch (status) {
    case 'GOING': return 'Accepted';
    case 'NOT_GOING': return 'Declined';
    case 'INTERESTED': return 'Maybe';
    default: return 'Declined';
  }
}
