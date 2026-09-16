import { del, get, put } from './client';

export type DirectoryFavorite = {
  targetKind: string;
  targetId: string;
  createdAt: string;
  result?: unknown | null;
};

const eventFavoritePath = (eventId: string) =>
  `/directory/favorites/event/${encodeURIComponent(eventId)}`;

export async function listDirectoryEventFavorites(): Promise<DirectoryFavorite[]> {
  return get<DirectoryFavorite[]>('/directory/favorites?targetKind=event');
}

export async function saveDirectoryEventFavorite(eventId: string): Promise<void> {
  await put<unknown>(eventFavoritePath(eventId), undefined);
}

export async function deleteDirectoryEventFavorite(eventId: string): Promise<void> {
  await del<unknown>(eventFavoritePath(eventId));
}
