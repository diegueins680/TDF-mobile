import { get, post, put, del } from './client';
import type { ArtistProfile, ArtistProfileCreate, ArtistProfileUpdate, ArtistSocialLinks, ID } from '../types';
import { normalizePartyId as normalizeIdentityPartyId } from '../lib/identity';
import { normalizeOptionalTimestamp } from '../lib/isoDate';

type BackendArtistDTO = {
  artistId?: ID;
  artistPartyId?: ID;
  partyId?: ID;
  artistName?: string;
  artistBio?: string | null;
  artistAvatarUrl?: string | null;
  artistGenres?: string[];
  artistGenreIds?: string[];
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
const SOCIAL_LINK_KEYS = ['spotify', 'instagram', 'twitter', 'youtube', 'soundcloud'] as const;

type ArtistWrite = {
  partyId?: ID;
  name?: string;
  bio?: string | null;
  imageUrl?: string | null;
  genreIds?: string[];
  instagramHandle?: string | null;
  spotifyUrl?: string | null;
  socialLinks?: ArtistSocialLinks;
};

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

/**
 * Artist Profiles API - Wired to backend endpoints
 * Maps backend ArtistDTO to frontend ArtistProfile types
 */
export const Artists = {
  list: async (filters?: { name?: string; genreId?: string; limit?: number; offset?: number }): Promise<ArtistProfile[]> => {
    const query = new URLSearchParams();
    const name = filters?.name?.trim();
    const genreId = filters?.genreId?.trim();
    if (name) query.append('name', name);
    if (genreId) query.append('genreId', genreId);
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

  update: async (artistId: ID, body: ArtistProfileUpdate): Promise<ArtistProfile> => {
    const existing = await Artists.getById(artistId);
    const backendBody = mapFrontendArtistToBackend(mergeArtistUpdate(existing, body));
    const artist = await put<BackendArtistDTO>(`/social-events/artists/${artistId}`, backendBody);
    return mapBackendArtistToFrontend(artist);
  },

  searchByGenre: async (genreId: string): Promise<ArtistProfile[]> => {
    const artists = await get<BackendArtistDTO[]>(`/social-events/artists?genreId=${encodeURIComponent(genreId)}`);
    return artists.map((a) => mapBackendArtistToFrontend(a));
  },

  searchByName: async (name: string): Promise<ArtistProfile[]> => {
    const artists = await get<BackendArtistDTO[]>(`/social-events/artists?name=${encodeURIComponent(name)}`);
    return artists.map((a) => mapBackendArtistToFrontend(a));
  }

  , follow: async (artistId: ID, followerPartyId: string) => {
    const normalizedFollowerPartyId = normalizeIdentityPartyId(followerPartyId);
    if (!normalizedFollowerPartyId) {
      throw new Error('Party ID inválido para seguir artistas.');
    }
    const body = { followerPartyId: normalizedFollowerPartyId };
    const res = await post<ArtistFollower>(`/social-events/artists/${artistId}/follow`, body);
    return res;
  },

  unfollow: async (artistId: ID, followerPartyId: string) => {
    const normalizedFollowerPartyId = normalizeIdentityPartyId(followerPartyId);
    if (!normalizedFollowerPartyId) {
      throw new Error('Party ID inválido para dejar de seguir artistas.');
    }
    await del<void>(`/social-events/artists/${artistId}/follow?follower=${encodeURIComponent(normalizedFollowerPartyId)}`);
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
  const createdAt = normalizeOptionalTimestamp(a.artistCreatedAt) ?? nowIso;
  const updatedAt = normalizeOptionalTimestamp(a.artistUpdatedAt) ?? createdAt;
  return {
    id,
    partyId,
    name: a.artistName ?? '',
    bio: a.artistBio ?? null,
    imageUrl: a.artistAvatarUrl ?? null,
    genres: a.artistGenres ?? [],
    genreIds: a.artistGenreIds ?? [],
    instagramHandle: socialLinks?.instagram ?? null,
    spotifyUrl: socialLinks?.spotify ?? null,
    socialLinks,
    createdAt,
    updatedAt
  };
}

function mapFrontendArtistToBackend(body: ArtistWrite) {
  const socialLinks = buildSocialLinksPayload(body);
  return {
    artistPartyId: body.partyId != null ? String(body.partyId) : undefined,
    artistName: body.name,
    artistBio: normalizeOptionalText(body.bio),
    artistAvatarUrl: normalizeOptionalText(body.imageUrl),
    artistGenreIds: body.genreIds ?? [],
    artistSocialLinks: socialLinks
  };
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parseSafeInteger(raw: string): number | null {
  if (!/^-?\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function normalizeEntityId(raw: ID | undefined | null, fallback: ID): ID {
  if (typeof raw === 'number') return Number.isSafeInteger(raw) && raw > 0 ? raw : fallback;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return fallback;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? parsed : fallback;
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
    const parsed = parseSafeInteger(trimmed);
    if (parsed !== null) return parsed > 0 ? String(parsed) : null;
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

function buildSocialLinksPayload(body: ArtistWrite): ArtistSocialLinks | undefined {
  const candidate: ArtistSocialLinks = body.socialLinks ? { ...body.socialLinks } : {};
  if (body.instagramHandle !== undefined) {
    candidate.instagram = body.instagramHandle ?? null;
  }
  if (body.spotifyUrl !== undefined) {
    candidate.spotify = body.spotifyUrl ?? null;
  }
  const cleaned: ArtistSocialLinks = Object.fromEntries(
    Object.entries(candidate)
      .map(([key, value]) => [key, normalizeOptionalText(value)])
      .filter(([, value]) => typeof value === 'string')
  ) as ArtistSocialLinks;
  const hasAny = Object.values(cleaned).some((val) => typeof val === 'string');
  return hasAny ? cleaned : undefined;
}

function mergeArtistSocialLinks(existing: ArtistSocialLinks | undefined, patch: ArtistProfileUpdate): ArtistSocialLinks | undefined {
  let merged: ArtistSocialLinks = existing ? { ...existing } : {};

  if (hasOwn(patch, 'socialLinks')) {
    if (patch.socialLinks === null) {
      merged = {};
    } else if (patch.socialLinks) {
      for (const key of SOCIAL_LINK_KEYS) {
        if (hasOwn(patch.socialLinks, key)) {
          const value = patch.socialLinks[key];
          if (value !== undefined) {
            merged[key] = value;
          }
        }
      }
    }
  }

  if (patch.instagramHandle !== undefined) {
    merged.instagram = patch.instagramHandle ?? null;
  }

  if (patch.spotifyUrl !== undefined) {
    merged.spotify = patch.spotifyUrl ?? null;
  }

  return normalizeSocialLinks(merged);
}

function mergeArtistUpdate(existing: ArtistProfile, patch: ArtistProfileUpdate): ArtistWrite {
  const mergedBio = hasOwn(patch, 'bio')
    ? patch.bio === null
      ? undefined
      : patch.bio ?? existing.bio ?? undefined
    : existing.bio ?? undefined;

  const mergedImageUrl = hasOwn(patch, 'imageUrl')
    ? patch.imageUrl === null
      ? undefined
      : patch.imageUrl ?? existing.imageUrl ?? undefined
    : existing.imageUrl ?? undefined;

  return {
    partyId: patch.partyId ?? existing.partyId,
    name: patch.name ?? existing.name,
    bio: mergedBio,
    imageUrl: mergedImageUrl,
    genreIds: patch.genreIds ?? existing.genreIds ?? [],
    socialLinks: mergeArtistSocialLinks(existing.socialLinks, patch),
  };
}
