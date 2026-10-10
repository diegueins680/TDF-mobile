import type { DirectoryEntityType } from '../../api/directory';
import { API_BASE } from '../../lib/api';

export type DirectoryPreviewKind = DirectoryEntityType;

// The backend resolves the canonical preview image (cover, featured image,
// linked profile media, avatar/logo, first portfolio image). Clients only make
// that URL absolute and render the placeholder when no valid media exists.
export function resolveDirectoryPreviewImage(value: unknown, apiBase: string = API_BASE): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || /[\s\\]/.test(trimmed)) return undefined;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return `${apiBase.replace(/\/+$/, '')}${trimmed}`;
  const match = /^https:\/\/([^/?#]+)/i.exec(trimmed);
  if (!match || match[1]?.includes('@')) return undefined;
  return trimmed;
}

export const DIRECTORY_PREVIEW_PLACEHOLDERS: Record<DirectoryPreviewKind, string> = {
  profile: '🎤',
  classified: '📣',
  event: '🎟️',
  venue: '📍',
};
