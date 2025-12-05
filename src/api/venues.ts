import { get, post, put } from './client';
import type { Venue, VenueCreate, ID } from '../types';

/**
 * Venues API
 */
export const Venues = {
  list: async (filters?: { city?: string; nearCoords?: { lat: number; lng: number; radiusKm?: number } }): Promise<Venue[]> => {
    const query = new URLSearchParams();
    if (filters?.city) query.append('city', filters.city);
    if (filters?.nearCoords) {
      query.append('lat', String(filters.nearCoords.lat));
      query.append('lng', String(filters.nearCoords.lng));
      if (filters.nearCoords.radiusKm) query.append('radiusKm', String(filters.nearCoords.radiusKm));
    }
    
    const url = `/venues${query.toString() ? '?' + query.toString() : ''}`;
    return get<Venue[]>(url);
  },

  getById: async (venueId: ID): Promise<Venue> => {
    return get<Venue>(`/venues/${venueId}`);
  },

  create: async (body: VenueCreate): Promise<Venue> => {
    return post<Venue>('/venues', body);
  },

  update: async (venueId: ID, body: Partial<VenueCreate>): Promise<Venue> => {
    return put<Venue>(`/venues/${venueId}`, body);
  },

  search: async (query: string): Promise<Venue[]> => {
    return get<Venue[]>(`/venues/search?q=${encodeURIComponent(query)}`);
  }
};
