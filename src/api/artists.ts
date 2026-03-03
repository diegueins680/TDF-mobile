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

/**
 * Artist Profiles API - Wired to backend endpoints
 * Maps backend ArtistDTO to frontend ArtistProfile types
 */
export const Artists = {
  list: async (filters?: { name?: string; genre?: string; limit?: number; offset?: number }): Promise<ArtistProfile[]> => {
    const query = new URLSearchParams();
    if (filters?.name) query.append('name', filters.name);
    if (filters?.genre) query.append('genre', filters.genre);
    if (filters?.limit) query.append('limit', filters.limit.toString());
    if (filters?.offset) query.append('offset', filters.offset.toString());
    
    const url = `/social-events/artists${query.toString() ? '?' + query.toString() : ''}`;
    const artists = await get<BackendArtistDTO[]>(url);
    return artists.map((a) => mapBackendArtistToFrontend(a));
  },

  getById: async (artistId: ID): Promise<ArtistProfile> => {
    const artist = await get<BackendArtistDTO>(`/social-events/artists/${artistId}`);
    return mapBackendArtistToFrontend(artist);
  },

  getByParty: async (partyId: ID): Promise<ArtistProfile> => {
    return get<ArtistProfile>(`/parties/${partyId}/artist-profile`);
  },

  create: async (body: ArtistProfileCreate): Promise<ArtistProfile> => {
    const backendBody = mapFrontendArtistToBackend(body);
    const artist = await post<BackendArtistDTO>('/social-events/artists', backendBody);
    return mapBackendArtistToFrontend(artist);
  },

  update: async (artistId: ID, body: Partial<ArtistProfileCreate>): Promise<ArtistProfile> => {
    const backendBody = mapFrontendArtistToBackend(body);
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
  const id = normalizeEntityId(a.artistId, 0);
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
    artistBio: body.bio || undefined,
    artistAvatarUrl: body.imageUrl || undefined,
    artistGenres: body.genres || [],
    artistSocialLinks: socialLinks
  };
}

function normalizeEntityId(raw: ID | undefined | null, fallback: ID): ID {
  if (typeof raw === 'number') return raw;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return fallback;
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return trimmed;
}

function normalizeSocialLinks(raw?: ArtistSocialLinks | null): ArtistSocialLinks | undefined {
  if (!raw) return undefined;
  const clean: ArtistSocialLinks = {
    spotify: raw.spotify ? raw.spotify.trim() : raw.spotify ?? undefined,
    instagram: raw.instagram ? raw.instagram.trim() : raw.instagram ?? undefined,
    twitter: raw.twitter ? raw.twitter.trim() : raw.twitter ?? undefined,
    youtube: raw.youtube ? raw.youtube.trim() : raw.youtube ?? undefined,
    soundcloud: raw.soundcloud ? raw.soundcloud.trim() : raw.soundcloud ?? undefined
  };
  const hasAny = Object.values(clean).some((val) => typeof val === 'string' && val.length > 0);
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
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
      .filter(([, value]) => value !== '')
  ) as ArtistSocialLinks;
  const hasAny = Object.values(cleaned).some((val) => typeof val === 'string' && val.length > 0);
  return hasAny ? cleaned : undefined;
}
