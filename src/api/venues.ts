import { get, post, put } from './client';
import type { Venue, VenueCreate, ID } from '../types';

type VenueContact = {
  phone?: string | null;
  website?: string | null;
};

const normalizeOptionalText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const parseSafeInteger = (value: string): number | null => {
  if (!/^-?\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const normalizeId = (value: ID, fallback: ID = 0): ID => {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? parsed : fallback;
  return trimmed;
};

const deriveStateFromCity = (city: string): string | null => {
  if (!city.includes(',')) return null;
  const parts = city.split(',').map((part) => part.trim());
  return normalizeOptionalText(parts[1]);
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
    const city = filters?.city?.trim();
    const textQuery = filters?.query?.trim();
    if (city) query.append('city', city);
    if (textQuery) query.append('q', textQuery);
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
  const city = normalizeOptionalText(v.venueCity) ?? '';
  const state = normalizeOptionalText(v.venueState) ?? deriveStateFromCity(city);
  return {
    id: normalizeId(v.venueId),
    name: v.venueName,
    address: normalizeOptionalText(v.venueAddress) ?? '',
    city,
    country: normalizeOptionalText(v.venueCountry),
    state,
    zipCode: normalizeOptionalText(v.venueZipCode),
    latitude: v.venueLat ?? 0,
    longitude: v.venueLng ?? 0,
    capacity: v.venueCapacity ?? null,
    imageUrl: normalizeOptionalText(v.venueImageUrl),
    phoneNumber: normalizeOptionalText(v.venuePhone) ?? contact.phone ?? null,
    website: normalizeOptionalText(v.venueWebsite) ?? contact.website ?? null,
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
  if (typeof raw === 'string') return { phone: normalizeOptionalText(raw) };
  return {
    phone: normalizeOptionalText(raw.phone),
    website: normalizeOptionalText(raw.website)
  };
}
