import { get, post, put } from './client';
import type { ArtistProfile, ArtistProfileCreate, ID } from '../types';

/**
 * Artist Profiles API
 */
export const Artists = {
  getById: async (artistId: ID): Promise<ArtistProfile> => {
    return get<ArtistProfile>(`/artists/${artistId}`);
  },

  getByParty: async (partyId: ID): Promise<ArtistProfile> => {
    return get<ArtistProfile>(`/parties/${partyId}/artist-profile`);
  },

  create: async (body: ArtistProfileCreate): Promise<ArtistProfile> => {
    return post<ArtistProfile>('/artists', body);
  },

  update: async (artistId: ID, body: Partial<ArtistProfileCreate>): Promise<ArtistProfile> => {
    return put<ArtistProfile>(`/artists/${artistId}`, body);
  },

  searchByGenre: async (genre: string): Promise<ArtistProfile[]> => {
    return get<ArtistProfile[]>(`/artists/search?genre=${encodeURIComponent(genre)}`);
  },

  searchByName: async (name: string): Promise<ArtistProfile[]> => {
    return get<ArtistProfile[]>(`/artists/search?name=${encodeURIComponent(name)}`);
  }
};
