import { get, post } from './client';
import type {
  EventLiveBroadcast,
  EventLiveBroadcastCreateInput,
  EventLiveBroadcastHeartbeatInput,
  EventLiveBroadcastQuality,
  EventLiveBroadcastStatus,
  ID,
} from '../types';

type BackendLiveBroadcastDTO = {
  elbId?: ID | null;
  id?: ID | null;
  elbEventId?: ID | null;
  eventId?: ID | null;
  elbArtistId?: ID | null;
  artistId?: ID | null;
  elbArtistName?: string | null;
  artistName?: string | null;
  elbBroadcasterName?: string | null;
  broadcasterName?: string | null;
  elbBroadcasterPartyId?: ID | null;
  broadcasterPartyId?: ID | null;
  elbTitle?: string | null;
  title?: string | null;
  elbDescription?: string | null;
  description?: string | null;
  elbStatus?: string | null;
  status?: string | null;
  elbPlaybackUrl?: string | null;
  playbackUrl?: string | null;
  streamUrl?: string | null;
  rtiStreamUrl?: string | null;
  elbIngestUrl?: string | null;
  ingestUrl?: string | null;
  rtiIngestUrl?: string | null;
  elbWhipUrl?: string | null;
  whipUrl?: string | null;
  rtiWhipUrl?: string | null;
  elbStreamKey?: string | null;
  streamKey?: string | null;
  rtiStreamKey?: string | null;
  elbViewerCount?: number | null;
  viewerCount?: number | null;
  elbStartedAt?: string | null;
  startedAt?: string | null;
  elbEndedAt?: string | null;
  endedAt?: string | null;
  elbLastHeartbeatAt?: string | null;
  lastHeartbeatAt?: string | null;
};

type RadioTransmissionInfoDTO = {
  rtiStreamId?: ID;
  rtiStreamUrl?: string;
  rtiIngestUrl?: string;
  rtiStreamKey?: string;
  rtiWhipUrl?: string;
  streamUrl?: string;
  ingestUrl?: string;
  streamKey?: string;
  whipUrl?: string;
};

export type ProvisionedBroadcastTransmission = {
  playbackUrl?: string | null;
  ingestUrl?: string | null;
  whipUrl?: string | null;
  streamKey?: string | null;
};

const parseSafeInteger = (value: string): number | null => {
  if (!/^-?\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const normalizeId = (value: ID | null | undefined): string | null => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return null;
  const parsed = parseSafeInteger(trimmed);
  if (parsed !== null) return parsed > 0 ? String(parsed) : null;
  return trimmed;
};

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeTimestamp = (value: unknown, fallback: string): string => {
  const text = normalizeText(value);
  if (!text) return fallback;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
};

const normalizeStatus = (value: unknown): EventLiveBroadcastStatus => {
  const normalized = normalizeText(value)?.toLowerCase();
  return normalized === 'ended' ? 'ended' : 'live';
};

const normalizeQuality = (quality: EventLiveBroadcastQuality | undefined): EventLiveBroadcastQuality =>
  quality === '720p' || quality === '480p' ? quality : 'auto';

const normalizeViewerCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
};

const mapBackendBroadcast = (dto: BackendLiveBroadcastDTO, fallbackEventId: ID, index = 0): EventLiveBroadcast => {
  const nowIso = new Date().toISOString();
  const eventId = normalizeId(dto.elbEventId ?? dto.eventId ?? fallbackEventId) ?? String(fallbackEventId);
  const artistId = normalizeId(dto.elbArtistId ?? dto.artistId) ?? 'unknown';
  const startedAt = normalizeTimestamp(dto.elbStartedAt ?? dto.startedAt, nowIso);
  const endedAt = normalizeTimestamp(dto.elbEndedAt ?? dto.endedAt, '');
  const status = normalizeStatus(dto.elbStatus ?? dto.status);

  return {
    id: normalizeId(dto.elbId ?? dto.id) ?? `remote-live:${eventId}:${index}`,
    eventId,
    artistId,
    artistName: normalizeText(dto.elbArtistName ?? dto.artistName) ?? 'Artista',
    broadcasterName: normalizeText(dto.elbBroadcasterName ?? dto.broadcasterName) ?? 'Fan',
    broadcasterPartyId: normalizeId(dto.elbBroadcasterPartyId ?? dto.broadcasterPartyId),
    title: normalizeText(dto.elbTitle ?? dto.title) ?? 'Fanclub Live',
    description: normalizeText(dto.elbDescription ?? dto.description),
    status,
    playbackUrl: normalizeText(dto.elbPlaybackUrl ?? dto.playbackUrl ?? dto.streamUrl ?? dto.rtiStreamUrl),
    ingestUrl: normalizeText(dto.elbIngestUrl ?? dto.ingestUrl ?? dto.rtiIngestUrl),
    whipUrl: normalizeText(dto.elbWhipUrl ?? dto.whipUrl ?? dto.rtiWhipUrl),
    streamKey: normalizeText(dto.elbStreamKey ?? dto.streamKey ?? dto.rtiStreamKey),
    viewerCount: normalizeViewerCount(dto.elbViewerCount ?? dto.viewerCount),
    startedAt,
    endedAt: endedAt || null,
    lastHeartbeatAt: normalizeTimestamp(dto.elbLastHeartbeatAt ?? dto.lastHeartbeatAt, status === 'ended' ? endedAt || startedAt : nowIso),
  };
};

export const LiveBroadcasts = {
  listByEvent: async (eventId: ID): Promise<EventLiveBroadcast[]> => {
    const list = await get<BackendLiveBroadcastDTO[]>(`/social-events/events/${eventId}/live-broadcasts`);
    return list.map((dto, index) => mapBackendBroadcast(dto, eventId, index));
  },

  start: async (input: EventLiveBroadcastCreateInput): Promise<EventLiveBroadcast> => {
    const payload = {
      elbCreateArtistId: String(input.artistId),
      elbCreateArtistName: input.artistName,
      elbCreateBroadcasterName: input.broadcasterName,
      elbCreateBroadcasterPartyId: input.broadcasterPartyId != null ? String(input.broadcasterPartyId) : undefined,
      elbCreateTitle: input.title ?? null,
      elbCreateDescription: input.description ?? null,
      elbCreateQuality: normalizeQuality(input.quality),
    };
    const dto = await post<BackendLiveBroadcastDTO>(
      `/social-events/events/${input.eventId}/live-broadcasts`,
      payload,
    );
    return mapBackendBroadcast(dto, input.eventId);
  },

  end: async (eventId: ID, broadcastId: string, broadcasterPartyId?: ID | null): Promise<EventLiveBroadcast> => {
    const dto = await post<BackendLiveBroadcastDTO>(
      `/social-events/events/${eventId}/live-broadcasts/${encodeURIComponent(broadcastId)}/end`,
      {
        elbEndBroadcasterPartyId: broadcasterPartyId != null ? String(broadcasterPartyId) : undefined,
      },
    );
    return mapBackendBroadcast(dto, eventId);
  },

  heartbeat: async (input: EventLiveBroadcastHeartbeatInput): Promise<EventLiveBroadcast> => {
    const dto = await post<BackendLiveBroadcastDTO>(
      `/social-events/events/${input.eventId}/live-broadcasts/${encodeURIComponent(input.broadcastId)}/heartbeat`,
      {
        elbhViewerDelta: input.viewerDelta ?? 0,
      },
    );
    return mapBackendBroadcast(dto, input.eventId);
  },

  provisionTransmission: async (input: EventLiveBroadcastCreateInput): Promise<ProvisionedBroadcastTransmission> => {
    const title = normalizeText(input.title) ?? `${input.artistName} en vivo`;
    const dto = await post<RadioTransmissionInfoDTO>('/radio/transmissions', {
      rtrName: title,
      rtrGenre: 'Fanclub Live',
      rtrCountry: undefined,
    });

    return {
      playbackUrl: normalizeText(dto.rtiStreamUrl ?? dto.streamUrl),
      ingestUrl: normalizeText(dto.rtiIngestUrl ?? dto.ingestUrl),
      whipUrl: normalizeText(dto.rtiWhipUrl ?? dto.whipUrl),
      streamKey: normalizeText(dto.rtiStreamKey ?? dto.streamKey),
    };
  },
};
