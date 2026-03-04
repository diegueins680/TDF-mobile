import { get, post, put, del } from './client';
import type { ArtistProfile, ArtistProfileCreate, ArtistSocialLinks, ID } from '../types';

type BackendArtistDTO = {
  artistId?: ID;
  artistPartyId?: ID;
  partyId?: ID;
  artistName?: string;
  artistBio?: string | null;
  artistAvatarUrl?: string | null;
  artistGenres?: string[];
  artistSocialLinks?: ArtistSocialLinks;
  artistCreatedAt?: string | null;
  artistUpdatedAt?: string | null;
};

export type ArtistFollower = {
  followId?: ID;
  artistId?: ID;
  followerPartyId: string;
  createdAt?: string;
};

const ARTIST_LOOKUP_PAGE_SIZE = 100;
const ARTIST_LOOKUP_MAX_PAGES = 20;

/**
 * Artist Profiles API - Wired to backend endpoints
 * Maps backend ArtistDTO to frontend ArtistProfile types
 */
export const Artists = {
  list: async (filters?: { name?: string; genre?: string; limit?: number; offset?: number }): Promise<ArtistProfile[]> => {
    const query = new URLSearchParams();
    if (filters?.name) query.append('name', filters.name);
    if (filters?.genre) query.append('genre', filters.genre);
    if (typeof filters?.limit === 'number' && Number.isFinite(filters.limit) && filters.limit > 0) {
      query.append('limit', String(Math.trunc(filters.limit)));
    }
    if (typeof filters?.offset === 'number' && Number.isFinite(filters.offset) && filters.offset >= 0) {
      query.append('offset', String(Math.trunc(filters.offset)));
    }
    
    const url = `/social-events/artists${query.toString() ? '?' + query.toString() : ''}`;
    const artists = await get<BackendArtistDTO[]>(url);
    return artists.map((a) => mapBackendArtistToFrontend(a));
  },

  getById: async (artistId: ID): Promise<ArtistProfile> => {
    const artist = await get<BackendArtistDTO>(`/social-events/artists/${artistId}`);
    return mapBackendArtistToFrontend(artist);
  },

  getByParty: async (partyId: ID): Promise<ArtistProfile> => {
    const targetPartyId = normalizeLookupId(partyId);
    if (!targetPartyId) {
      throw new Error('Party ID inválido para buscar perfil de artista.');
    }

    for (let page = 0; page < ARTIST_LOOKUP_MAX_PAGES; page += 1) {
      const offset = page * ARTIST_LOOKUP_PAGE_SIZE;
      const artists = await Artists.list({
        limit: ARTIST_LOOKUP_PAGE_SIZE,
        offset,
      });
      const match = artists.find(
        (artist) => normalizeLookupId(artist.partyId) === targetPartyId,
      );
      if (match) return match;
      if (artists.length < ARTIST_LOOKUP_PAGE_SIZE) break;
    }

    throw new Error(`No existe perfil de artista para partyId ${targetPartyId}.`);
  },

  create: async (body: ArtistProfileCreate): Promise<ArtistProfile> => {
    const backendBody = mapFrontendArtistToBackend(body);
    const artist = await post<BackendArtistDTO>('/social-events/artists', backendBody);
    return mapBackendArtistToFrontend(artist);
  },

  update: async (artistId: ID, body: Partial<ArtistProfileCreate>): Promise<ArtistProfile> => {
    const existing = await Artists.getById(artistId);
    const backendBody = mapFrontendArtistToBackend(mergeArtistUpdate(existing, body));
    const artist = await put<BackendArtistDTO>(`/social-events/artists/${artistId}`, backendBody);
    return mapBackendArtistToFrontend(artist);
  },

  searchByGenre: async (genre: string): Promise<ArtistProfile[]> => {
    const artists = await get<BackendArtistDTO[]>(`/social-events/artists?genre=${encodeURIComponent(genre)}`);
    return artists.map((a) => mapBackendArtistToFrontend(a));
  },

  searchByName: async (name: string): Promise<ArtistProfile[]> => {
    const artists = await get<BackendArtistDTO[]>(`/social-events/artists?name=${encodeURIComponent(name)}`);
    return artists.map((a) => mapBackendArtistToFrontend(a));
  }

  , follow: async (artistId: ID, followerPartyId: string) => {
    const body = { followerPartyId };
    const res = await post<ArtistFollower>(`/social-events/artists/${artistId}/follow`, body);
    return res;
  },

  unfollow: async (artistId: ID, followerPartyId: string) => {
    await del<void>(`/social-events/artists/${artistId}/follow?follower=${encodeURIComponent(String(followerPartyId))}`);
    return true;
  },

  listFollowers: async (artistId: ID): Promise<ArtistFollower[]> => {
    const rows = await get<ArtistFollower[]>(`/social-events/artists/${artistId}/followers`);
    return rows;
  }
};

// Mapping functions to convert between backend ArtistDTO and frontend ArtistProfile
export function mapBackendArtistToFrontend(a: BackendArtistDTO): ArtistProfile {
  const nowIso = new Date().toISOString();
  const socialLinks = normalizeSocialLinks(a.artistSocialLinks);
  const partyFallbackId = normalizeEntityId(a.artistPartyId ?? a.partyId, 0);
  const id = normalizeEntityId(a.artistId, partyFallbackId);
  const partyId = normalizeEntityId(a.artistPartyId ?? a.partyId, id);
  return {
    id,
    partyId,
    name: a.artistName ?? '',
    bio: a.artistBio ?? null,
    imageUrl: a.artistAvatarUrl ?? null,
    genres: a.artistGenres ?? [],
    instagramHandle: socialLinks?.instagram ?? null,
    spotifyUrl: socialLinks?.spotify ?? null,
    socialLinks,
    createdAt: a.artistCreatedAt ?? nowIso,
    updatedAt: a.artistUpdatedAt ?? a.artistCreatedAt ?? nowIso
  };
}

function mapFrontendArtistToBackend(body: Partial<ArtistProfileCreate>) {
  const socialLinks = buildSocialLinksPayload(body);
  return {
    artistPartyId: body.partyId != null ? String(body.partyId) : undefined,
    artistName: body.name,
    artistBio: normalizeOptionalText(body.bio),
    artistAvatarUrl: normalizeOptionalText(body.imageUrl),
    artistGenres: body.genres ?? [],
    artistSocialLinks: socialLinks
  };
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function normalizeEntityId(raw: ID | undefined | null, fallback: ID): ID {
  if (typeof raw === 'number') return Number.isSafeInteger(raw) ? raw : fallback;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return fallback;
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return trimmed;
}

function normalizeLookupId(raw: ID | undefined | null): string | null {
  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw <= 0) return null;
    return String(raw);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
      return String(parsed);
    }
    return trimmed;
  }
  return null;
}

function normalizeSocialLinks(raw?: ArtistSocialLinks | null): ArtistSocialLinks | undefined {
  if (!raw) return undefined;
  const clean: ArtistSocialLinks = {
    spotify: normalizeOptionalText(raw.spotify),
    instagram: normalizeOptionalText(raw.instagram),
    twitter: normalizeOptionalText(raw.twitter),
    youtube: normalizeOptionalText(raw.youtube),
    soundcloud: normalizeOptionalText(raw.soundcloud)
  };
  const hasAny = Object.values(clean).some((val) => typeof val === 'string');
  return hasAny ? clean : undefined;
}

function buildSocialLinksPayload(body: Partial<ArtistProfileCreate>): ArtistSocialLinks | undefined {
  const candidate: ArtistSocialLinks = {
    instagram: body.instagramHandle ?? body.socialLinks?.instagram ?? undefined,
    spotify: body.spotifyUrl ?? body.socialLinks?.spotify ?? undefined,
    twitter: body.socialLinks?.twitter ?? undefined,
    youtube: body.socialLinks?.youtube ?? undefined,
    soundcloud: body.socialLinks?.soundcloud ?? undefined
  };
  const cleaned: ArtistSocialLinks = Object.fromEntries(
    Object.entries(candidate)
      .map(([key, value]) => [key, normalizeOptionalText(value)])
      .filter(([, value]) => typeof value === 'string')
  ) as ArtistSocialLinks;
  const hasAny = Object.values(cleaned).some((val) => typeof val === 'string');
  return hasAny ? cleaned : undefined;
}

function mergeArtistUpdate(existing: ArtistProfile, patch: Partial<ArtistProfileCreate>): ArtistProfileCreate {
  return {
    partyId: patch.partyId ?? existing.partyId,
    name: patch.name ?? existing.name,
    bio: patch.bio ?? existing.bio ?? undefined,
    imageUrl: patch.imageUrl ?? existing.imageUrl ?? undefined,
    genres: patch.genres ?? existing.genres ?? [],
    instagramHandle: patch.instagramHandle ?? existing.instagramHandle ?? undefined,
    spotifyUrl: patch.spotifyUrl ?? existing.spotifyUrl ?? undefined,
    socialLinks: patch.socialLinks ?? existing.socialLinks ?? undefined,
  };
}
