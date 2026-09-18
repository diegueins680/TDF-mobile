import { get, post } from './client';
import type { FanArtist, FanArtistFollow } from '../types';

// Use the same catalog, persisted subscription and engagement evidence as web
// FanHub. Social-event artist IDs belong to a different resource namespace.
export const FanArtists = {
  list: (): Promise<FanArtist[]> => get('/fans/artists'),
  listFollows: (): Promise<FanArtistFollow[]> => get('/fans/me/follows'),
  follow: (artistPartyId: number): Promise<FanArtistFollow> => {
    if (!Number.isSafeInteger(artistPartyId) || artistPartyId <= 0) {
      return Promise.reject(new Error('No pudimos reconocer ese perfil.'));
    }
    return post(`/fans/me/follows/${artistPartyId}`, {});
  },
};
