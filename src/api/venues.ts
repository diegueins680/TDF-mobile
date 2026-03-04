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
  venuePhone?: string | null;
  venueWebsite?: string | null;
  venueState?: string | null;
  venueZipCode?: string | null;
  venueImageUrl?: string | null;
  venueCreatedAt?: string | null;
  venueUpdatedAt?: string | null;
};

/**
 * Venues API - Wired to backend endpoints
 * Maps backend VenueDTO to frontend Venue types
 */
export const Venues = {
  list: async (filters?: {
    city?: string;
    query?: string;
    limit?: number;
    offset?: number;
    near?: { lat: number; lng: number; radiusKm?: number };
  }): Promise<Venue[]> => {
    const query = new URLSearchParams();
    if (filters?.city) query.append('city', filters.city);
    if (filters?.query) query.append('q', filters.query);
    if (filters?.limit) query.append('limit', filters.limit.toString());
    if (filters?.offset) query.append('offset', filters.offset.toString());
    if (filters?.near) {
      const { lat, lng, radiusKm } = filters.near;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const nearParts = [lat.toString(), lng.toString()];
        if (typeof radiusKm === 'number' && Number.isFinite(radiusKm) && radiusKm > 0) {
          nearParts.push(radiusKm.toString());
        }
        query.append('near', nearParts.join(','));
      }
    }
    
    const url = `/social-events/venues${query.toString() ? '?' + query.toString() : ''}`;
    const venues = await get<BackendVenueDTO[]>(url);
    return venues.map((v) => mapBackendVenueToFrontend(v));
  },

  getById: async (venueId: ID): Promise<Venue> => {
    const venue = await get<BackendVenueDTO>(`/social-events/venues/${venueId}`);
    return mapBackendVenueToFrontend(venue);
  },

  create: async (body: VenueCreate): Promise<Venue> => {
    const backendBody = mapFrontendVenueToBackend({
      ...body,
      country: body.country ?? 'US'
    });
    const venue = await post<BackendVenueDTO>('/social-events/venues', backendBody);
    return mapBackendVenueToFrontend(venue);
  },

  update: async (venueId: ID, body: Partial<VenueCreate>): Promise<Venue> => {
    const existing = await Venues.getById(venueId);
    const backendBody = mapFrontendVenueToBackend(mergeVenueUpdate(existing, body));
    const venue = await put<BackendVenueDTO>(`/social-events/venues/${venueId}`, backendBody);
    return mapBackendVenueToFrontend(venue);
  },

  search: async (query: string): Promise<Venue[]> => {
    const trimmed = query.trim();
    if (!trimmed) return Venues.list();
    return Venues.list({ query: trimmed, limit: 100 });
  }
};

// Mapping functions to convert between backend VenueDTO and frontend Venue
function mapBackendVenueToFrontend(v: BackendVenueDTO): Venue {
  const nowIso = new Date().toISOString();
  const contact = normalizeContact(v.venueContact);
  const city = v.venueCity ?? '';
  const state = v.venueState ?? (city.includes(',') ? city.split(',').map((c) => c.trim())[1] ?? null : null);
  return {
    id: v.venueId,
    name: v.venueName,
    address: v.venueAddress || '',
    city,
    country: v.venueCountry ?? null,
    state,  // Try to extract state if available
    zipCode: v.venueZipCode ?? null,
    latitude: v.venueLat ?? 0,
    longitude: v.venueLng ?? 0,
    capacity: v.venueCapacity ?? null,
    imageUrl: v.venueImageUrl ?? null,
    phoneNumber: v.venuePhone ?? contact.phone ?? null,
    website: v.venueWebsite ?? contact.website ?? null,
    createdAt: v.venueCreatedAt ?? nowIso,
    updatedAt: v.venueUpdatedAt ?? v.venueCreatedAt ?? nowIso
  };
}

function mapFrontendVenueToBackend(body: Partial<VenueCreate>) {
  return {
    venueName: body.name,
    venueAddress: body.address,
    venueCity: body.city,
    venueCountry: body.country ?? null,
    venueLat: body.latitude,
    venueLng: body.longitude,
    venueCapacity: body.capacity,
    venueContact: body.phoneNumber ?? null,
    venuePhone: body.phoneNumber ?? null,
    venueWebsite: body.website ?? null,
    venueState: body.state ?? null,
    venueZipCode: body.zipCode ?? null,
    venueImageUrl: body.imageUrl ?? null
  };
}

function mergeVenueUpdate(existing: Venue, patch: Partial<VenueCreate>): VenueCreate {
  return {
    name: patch.name ?? existing.name,
    address: patch.address ?? existing.address,
    city: patch.city ?? existing.city,
    country: patch.country ?? existing.country ?? undefined,
    state: patch.state ?? existing.state ?? undefined,
    zipCode: patch.zipCode ?? existing.zipCode ?? undefined,
    latitude: patch.latitude ?? existing.latitude,
    longitude: patch.longitude ?? existing.longitude,
    capacity: patch.capacity ?? existing.capacity ?? undefined,
    imageUrl: patch.imageUrl ?? existing.imageUrl ?? undefined,
    phoneNumber: patch.phoneNumber ?? existing.phoneNumber ?? undefined,
    website: patch.website ?? existing.website ?? undefined,
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
