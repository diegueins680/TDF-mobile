import { get, post, put } from './client';
import type { ArtistProfile, ArtistProfileCreate, ID } from '../types';

type BackendArtistDTO = {
  artistId?: ID;
  partyId?: ID;
  artistName?: string;
  artistBio?: string | null;
  artistAvatarUrl?: string | null;
  artistGenres?: string[];
};

/**
 * Artist Profiles API - Wired to backend endpoints
 * Maps backend ArtistDTO to frontend ArtistProfile types
 */
export const Artists = {
  list: async (filters?: { name?: string; genre?: string }): Promise<ArtistProfile[]> => {
    const query = new URLSearchParams();
    if (filters?.name) query.append('name', filters.name);
    if (filters?.genre) query.append('genre', filters.genre);
    
    const url = `/artists${query.toString() ? '?' + query.toString() : ''}`;
    const artists = await get<BackendArtistDTO[]>(url);
    return artists.map((a) => mapBackendArtistToFrontend(a));
  },

  getById: async (artistId: ID): Promise<ArtistProfile> => {
    const artist = await get<BackendArtistDTO>(`/artists/${artistId}`);
    return mapBackendArtistToFrontend(artist);
  },

  getByParty: async (partyId: ID): Promise<ArtistProfile> => {
    return get<ArtistProfile>(`/parties/${partyId}/artist-profile`);
  },

  create: async (body: ArtistProfileCreate): Promise<ArtistProfile> => {
    const backendBody = mapFrontendArtistToBackend(body);
    const artist = await post<BackendArtistDTO>('/artists', backendBody);
    return mapBackendArtistToFrontend(artist);
  },

  update: async (artistId: ID, body: Partial<ArtistProfileCreate>): Promise<ArtistProfile> => {
    const backendBody = mapFrontendArtistToBackend(body);
    const artist = await put<BackendArtistDTO>(`/artists/${artistId}`, backendBody);
    return mapBackendArtistToFrontend(artist);
  },

  searchByGenre: async (genre: string): Promise<ArtistProfile[]> => {
    const artists = await get<BackendArtistDTO[]>(`/artists?genre=${encodeURIComponent(genre)}`);
    return artists.map((a) => mapBackendArtistToFrontend(a));
  },

  searchByName: async (name: string): Promise<ArtistProfile[]> => {
    const artists = await get<BackendArtistDTO[]>(`/artists?name=${encodeURIComponent(name)}`);
    return artists.map((a) => mapBackendArtistToFrontend(a));
  }
};

// Mapping functions to convert between backend ArtistDTO and frontend ArtistProfile
function mapBackendArtistToFrontend(a: BackendArtistDTO): ArtistProfile {
  const id = a.artistId ? Number(a.artistId) : 0;
  return {
    id,
    partyId: a.partyId ? Number(a.partyId) : id,  // backend doesn't track partyId separately
    name: a.artistName ?? '',
    bio: a.artistBio ?? null,
    imageUrl: a.artistAvatarUrl ?? null,
    genres: a.artistGenres ?? [],
    instagramHandle: null,  // Not yet in backend
    spotifyUrl: null,       // Not yet in backend
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function mapFrontendArtistToBackend(body: Partial<ArtistProfileCreate>) {
  return {
    artistName: body.name,
    artistBio: body.bio || undefined,
    artistAvatarUrl: body.imageUrl || undefined,
    artistGenres: body.genres || []
  };
}
