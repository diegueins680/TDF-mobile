import type { components } from './generated/types';
import { http, normalizeApiError } from './client';

export type RecordsFeed = components['schemas']['RecordsFeed'];

export interface RecordsFeedResult {
  feed: RecordsFeed | null;
  etag: string | null;
  notModified: boolean;
}

export async function fetchRecordsFeed(
  locale: string,
  etag?: string | null,
): Promise<RecordsFeedResult> {
  const params = new URLSearchParams({ locale: locale.trim() || 'es' });
  try {
    const response = await http.get<RecordsFeed>(`/records/feed?${params.toString()}`, {
      headers: etag ? { 'If-None-Match': etag } : undefined,
      validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
    });
    const responseEtag = typeof response.headers.etag === 'string' ? response.headers.etag : null;
    if (response.status === 304) {
      return { feed: null, etag: responseEtag ?? etag ?? null, notModified: true };
    }
    return { feed: response.data, etag: responseEtag, notModified: false };
  } catch (error) {
    throw normalizeApiError(error);
  }
}
