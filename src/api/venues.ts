import { get, post, put } from './client';
import type { Venue, VenueCreate, ID } from '../types';

type VenueContact = {
  phone?: string | null;
  website?: string | null;
};

type BackendVenueDTO = {
  venueId: ID;
  venueName: string;
  venueAddress?: string | null;
  venueCity?: string | null;
  venueCountry?: string | null;
  venueLat?: number | null;
  venueLng?: number | null;
  venueCapacity?: number | null;
  venueContact?: string | VenueContact | null;
};

/**
 * Venues API - Wired to backend endpoints
 * Maps backend VenueDTO to frontend Venue types
 */
export const Venues = {
  list: async (filters?: { city?: string }): Promise<Venue[]> => {
    const query = new URLSearchParams();
    if (filters?.city) query.append('city', filters.city);
    
    const url = `/venues${query.toString() ? '?' + query.toString() : ''}`;
    const venues = await get<BackendVenueDTO[]>(url);
    return venues.map((v) => mapBackendVenueToFrontend(v));
  },

  getById: async (venueId: ID): Promise<Venue> => {
    const venue = await get<BackendVenueDTO>(`/venues/${venueId}`);
    return mapBackendVenueToFrontend(venue);
  },

  create: async (body: VenueCreate): Promise<Venue> => {
    const backendBody = mapFrontendVenueToBackend(body);
    const venue = await post<BackendVenueDTO>('/venues', backendBody);
    return mapBackendVenueToFrontend(venue);
  },

  update: async (venueId: ID, body: Partial<VenueCreate>): Promise<Venue> => {
    const backendBody = mapFrontendVenueToBackend(body);
    const venue = await put<BackendVenueDTO>(`/venues/${venueId}`, backendBody);
    return mapBackendVenueToFrontend(venue);
  },

  search: async (query: string): Promise<Venue[]> => {
    // Backend doesn't have search; use list instead
    const venues = await get<BackendVenueDTO[]>('/venues');
    return venues
      .map((v) => mapBackendVenueToFrontend(v))
      .filter((v) => 
        v.name.toLowerCase().includes(query.toLowerCase()) ||
        v.city?.toLowerCase().includes(query.toLowerCase()) ||
        v.address?.toLowerCase().includes(query.toLowerCase())
      );
  }
};

// Mapping functions to convert between backend VenueDTO and frontend Venue
function mapBackendVenueToFrontend(v: BackendVenueDTO): Venue {
  const contact = normalizeContact(v.venueContact);
  const city = v.venueCity ?? '';
  const state = city.includes(',') ? city.split(',').map((c) => c.trim())[1] ?? null : null;
  return {
    id: v.venueId,
    name: v.venueName,
    address: v.venueAddress || '',
    city,
    state,  // Try to extract state if available
    zipCode: null, // backend doesn't store zipCode
    latitude: v.venueLat ?? 0,
    longitude: v.venueLng ?? 0,
    capacity: v.venueCapacity ?? null,
    imageUrl: null, // backend doesn't store images yet
    phoneNumber: contact.phone ?? null,
    website: contact.website ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function mapFrontendVenueToBackend(body: Partial<VenueCreate>) {
  const contact: VenueContact | null = body.phoneNumber || body.website
    ? { phone: body.phoneNumber ?? null, website: body.website ?? null }
    : null;
  return {
    venueName: body.name,
    venueAddress: body.address,
    venueCity: body.city,
    venueCountry: body.country || 'US', // Default to US if not specified
    venueLat: body.latitude,
    venueLng: body.longitude,
    venueCapacity: body.capacity,
    venueContact: contact
  };
}

function normalizeContact(raw: BackendVenueDTO['venueContact']): VenueContact {
  if (!raw) return {};
  if (typeof raw === 'string') return { phone: raw };
  return {
    phone: raw.phone ?? null,
    website: raw.website ?? null
  };
}
