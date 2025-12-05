import { get, post, put, patch } from './client';
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
 * Social Events API
 */
export const Events = {
  // Event CRUD
  list: async (filters?: { city?: string; artistId?: ID; upcomingOnly?: boolean }): Promise<SocialEvent[]> => {
    const query = new URLSearchParams();
    if (filters?.city) query.append('city', filters.city);
    if (filters?.artistId) query.append('artistId', String(filters.artistId));
    if (filters?.upcomingOnly) query.append('upcomingOnly', 'true');
    
    const url = `/events${query.toString() ? '?' + query.toString() : ''}`;
    return get<SocialEvent[]>(url);
  },

  getById: async (eventId: ID): Promise<SocialEvent> => {
    return get<SocialEvent>(`/events/${eventId}`);
  },

  create: async (body: SocialEventCreate): Promise<SocialEvent> => {
    return post<SocialEvent>('/events', body);
  },

  update: async (eventId: ID, body: SocialEventUpdate): Promise<SocialEvent> => {
    return put<SocialEvent>(`/events/${eventId}`, body);
  },

  delete: async (eventId: ID): Promise<void> => {
    return post<void>(`/events/${eventId}/delete`, {});
  },

  // RSVP management
  getRSVPs: async (eventId: ID): Promise<EventRSVP[]> => {
    return get<EventRSVP[]>(`/events/${eventId}/rsvps`);
  },

  rsvp: async (body: EventRSVPCreate): Promise<EventRSVP> => {
    return post<EventRSVP>('/rsvps', body);
  },

  updateRSVP: async (rsvpId: ID, status: string): Promise<EventRSVP> => {
    return patch<EventRSVP>(`/rsvps/${rsvpId}`, { status });
  },

  // Invitations
  sendInvitation: async (body: EventInvitationCreate): Promise<EventInvitation> => {
    return post<EventInvitation>('/invitations', body);
  },

  getInvitations: async (userId: ID): Promise<EventInvitation[]> => {
    return get<EventInvitation[]>(`/users/${userId}/invitations`);
  },

  respondToInvitation: async (invitationId: ID, status: 'ACCEPTED' | 'DECLINED'): Promise<EventInvitation> => {
    return patch<EventInvitation>(`/invitations/${invitationId}`, { status });
  }
};
