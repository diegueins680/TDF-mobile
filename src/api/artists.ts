import { get, post, put } from './client';
import type { ArtistProfile, ArtistProfileCreate, ID } from '../types';

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
    const artists = await get<any[]>(url);
    return artists.map(a => mapBackendArtistToFrontend(a));
  },

  getById: async (artistId: ID): Promise<ArtistProfile> => {
    const artist = await get<any>(`/artists/${artistId}`);
    return mapBackendArtistToFrontend(artist);
  },

  getByParty: async (partyId: ID): Promise<ArtistProfile> => {
    return get<ArtistProfile>(`/parties/${partyId}/artist-profile`);
  },

  create: async (body: ArtistProfileCreate): Promise<ArtistProfile> => {
    const backendBody = mapFrontendArtistToBackend(body);
    const artist = await post<any>('/artists', backendBody);
    return mapBackendArtistToFrontend(artist);
  },

  update: async (artistId: ID, body: Partial<ArtistProfileCreate>): Promise<ArtistProfile> => {
    const backendBody = mapFrontendArtistToBackend(body);
    const artist = await put<any>(`/artists/${artistId}`, backendBody);
    return mapBackendArtistToFrontend(artist);
  },

  searchByGenre: async (genre: string): Promise<ArtistProfile[]> => {
    const artists = await get<any[]>(`/artists?genre=${encodeURIComponent(genre)}`);
    return artists.map(a => mapBackendArtistToFrontend(a));
  },

  searchByName: async (name: string): Promise<ArtistProfile[]> => {
    const artists = await get<any[]>(`/artists?name=${encodeURIComponent(name)}`);
    return artists.map(a => mapBackendArtistToFrontend(a));
  }
};

// Mapping functions to convert between backend ArtistDTO and frontend ArtistProfile
function mapBackendArtistToFrontend(a: any): ArtistProfile {
  return {
    id: a.artistId ? parseInt(a.artistId) : 0,
    partyId: a.partyId || 0,  // backend doesn't track partyId separately
    name: a.artistName || '',
    bio: a.artistBio || null,
    imageUrl: a.artistAvatarUrl || null,
    genres: a.artistGenres || [],
    instagramHandle: null,  // Not yet in backend
    spotifyUrl: null,       // Not yet in backend
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function mapFrontendArtistToBackend(body: any) {
  return {
    artistName: body.name,
    artistBio: body.bio || undefined,
    artistAvatarUrl: body.imageUrl || undefined,
    artistGenres: body.genres || []
  };
}
