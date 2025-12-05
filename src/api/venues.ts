import { get, post, put } from './client';
import type { Venue, VenueCreate, ID } from '../types';

/**
 * Venues API - Wired to backend endpoints
 * Maps backend VenueDTO to frontend Venue types
 */
export const Venues = {
  list: async (filters?: { city?: string }): Promise<Venue[]> => {
    const query = new URLSearchParams();
    if (filters?.city) query.append('city', filters.city);
    
    const url = `/venues${query.toString() ? '?' + query.toString() : ''}`;
    const venues = await get<any[]>(url);
    return venues.map(v => mapBackendVenueToFrontend(v));
  },

  getById: async (venueId: ID): Promise<Venue> => {
    const venue = await get<any>(`/venues/${venueId}`);
    return mapBackendVenueToFrontend(venue);
  },

  create: async (body: VenueCreate): Promise<Venue> => {
    const backendBody = mapFrontendVenueToBackend(body);
    const venue = await post<any>('/venues', backendBody);
    return mapBackendVenueToFrontend(venue);
  },

  update: async (venueId: ID, body: Partial<VenueCreate>): Promise<Venue> => {
    const backendBody = mapFrontendVenueToBackend(body);
    const venue = await put<any>(`/venues/${venueId}`, backendBody);
    return mapBackendVenueToFrontend(venue);
  },

  search: async (query: string): Promise<Venue[]> => {
    // Backend doesn't have search; use list instead
    const venues = await get<any[]>('/venues');
    return venues
      .map(v => mapBackendVenueToFrontend(v))
      .filter(v => 
        v.name.toLowerCase().includes(query.toLowerCase()) ||
        v.city?.toLowerCase().includes(query.toLowerCase()) ||
        v.address?.toLowerCase().includes(query.toLowerCase())
      );
  }
};

// Mapping functions to convert between backend VenueDTO and frontend Venue
function mapBackendVenueToFrontend(v: any): Venue {
  return {
    id: v.venueId,
    name: v.venueName,
    address: v.venueAddress || '',
    city: v.venueCity || '',
    state: v.venueCity?.split(', ')[1] || null,  // Try to extract state if available
    zipCode: null, // backend doesn't store zipCode
    latitude: v.venueLat || 0,
    longitude: v.venueLng || 0,
    capacity: v.venueCapacity || null,
    imageUrl: null, // backend doesn't store images yet
    phoneNumber: v.venueContact?.phone || null,  // If venueContact has phone
    website: v.venueContact?.website || null,    // If venueContact has website
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function mapFrontendVenueToBackend(body: any) {
  return {
    venueName: body.name,
    venueAddress: body.address,
    venueCity: body.city,
    venueCountry: body.country || 'US', // Default to US if not specified
    venueLat: body.latitude,
    venueLng: body.longitude,
    venueCapacity: body.capacity,
    venueContact: body.phoneNumber || body.website 
      ? { phone: body.phoneNumber, website: body.website }
      : null
  };
}
