import { get, post, put } from './client';
import type { Venue, VenueCreate, VenueUpdate, ID } from '../types';
import { normalizeOptionalTimestamp } from '../lib/isoDate';

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

const normalizeCoordinate = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const normalizeCapacity = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value >= 0 ? value : null;
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

type VenueWrite = {
  name?: string;
  address?: string;
  city?: string;
  country?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number;
  longitude?: number;
  capacity?: number | null;
  imageUrl?: string | null;
  phoneNumber?: string | null;
  website?: string | null;
};

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

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
    const backendBody = mapFrontendVenueToBackend(body);
    const venue = await post<BackendVenueDTO>('/social-events/venues', backendBody);
    return mapBackendVenueToFrontend(venue);
  },

  update: async (venueId: ID, body: VenueUpdate): Promise<Venue> => {
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
  const createdAt = normalizeOptionalTimestamp(v.venueCreatedAt) ?? nowIso;
  const updatedAt = normalizeOptionalTimestamp(v.venueUpdatedAt) ?? createdAt;
  return {
    id: normalizeId(v.venueId),
    name: v.venueName,
    address: normalizeOptionalText(v.venueAddress) ?? '',
    city,
    country: normalizeOptionalText(v.venueCountry),
    state,
    zipCode: normalizeOptionalText(v.venueZipCode),
    latitude: normalizeCoordinate(v.venueLat),
    longitude: normalizeCoordinate(v.venueLng),
    capacity: normalizeCapacity(v.venueCapacity),
    imageUrl: normalizeOptionalText(v.venueImageUrl),
    phoneNumber: normalizeOptionalText(v.venuePhone) ?? contact.phone ?? null,
    website: normalizeOptionalText(v.venueWebsite) ?? contact.website ?? null,
    createdAt,
    updatedAt
  };
}

function mapFrontendVenueToBackend(body: VenueWrite) {
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

function mergeVenueUpdate(existing: Venue, patch: VenueUpdate): VenueWrite {
  const mergedCountry = hasOwn(patch, 'country')
    ? patch.country === null
      ? undefined
      : patch.country ?? existing.country ?? undefined
    : existing.country ?? undefined;

  const mergedState = hasOwn(patch, 'state')
    ? patch.state === null
      ? undefined
      : patch.state ?? existing.state ?? undefined
    : existing.state ?? undefined;

  const mergedZipCode = hasOwn(patch, 'zipCode')
    ? patch.zipCode === null
      ? undefined
      : patch.zipCode ?? existing.zipCode ?? undefined
    : existing.zipCode ?? undefined;

  const mergedCapacity = (() => {
    if (!hasOwn(patch, 'capacity')) return existing.capacity ?? undefined;
    if (patch.capacity === null) return undefined;
    if (typeof patch.capacity === 'number' && Number.isFinite(patch.capacity) && patch.capacity >= 0) {
      return patch.capacity;
    }
    return existing.capacity ?? undefined;
  })();

  const mergedImageUrl = hasOwn(patch, 'imageUrl')
    ? patch.imageUrl === null
      ? undefined
      : patch.imageUrl ?? existing.imageUrl ?? undefined
    : existing.imageUrl ?? undefined;

  const mergedPhoneNumber = hasOwn(patch, 'phoneNumber')
    ? patch.phoneNumber === null
      ? undefined
      : patch.phoneNumber ?? existing.phoneNumber ?? undefined
    : existing.phoneNumber ?? undefined;

  const mergedWebsite = hasOwn(patch, 'website')
    ? patch.website === null
      ? undefined
      : patch.website ?? existing.website ?? undefined
    : existing.website ?? undefined;

  return {
    name: patch.name ?? existing.name,
    address: patch.address ?? existing.address,
    city: patch.city ?? existing.city,
    country: mergedCountry,
    state: mergedState,
    zipCode: mergedZipCode,
    latitude: patch.latitude ?? existing.latitude,
    longitude: patch.longitude ?? existing.longitude,
    capacity: mergedCapacity,
    imageUrl: mergedImageUrl,
    phoneNumber: mergedPhoneNumber,
    website: mergedWebsite,
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
