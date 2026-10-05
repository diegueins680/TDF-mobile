import axios from 'axios';

import { LiveBroadcasts } from '../api/liveBroadcasts';
import type {
  EventLiveBroadcast,
  EventLiveBroadcastCreateInput,
  EventLiveBroadcastHeartbeatInput,
  ID,
} from '../types';
import {
  createEventLiveBroadcast as createLocalBroadcast,
  endEventLiveBroadcast as endLocalBroadcast,
  heartbeatEventLiveBroadcast as heartbeatLocalBroadcast,
  listEventLiveBroadcasts as listLocalBroadcasts,
} from './liveBroadcasts';

type RemoteModeOptions = {
  preferRemote?: boolean;
};

export type LiveBroadcastMutationResult = {
  source: 'remote' | 'local';
  fallbackReason?: string;
};

export type CreateLiveBroadcastMutationResult = LiveBroadcastMutationResult & {
  broadcast: EventLiveBroadcast;
};

const LOCAL_BROADCAST_PREFIX = 'live-';

const sortBroadcasts = (broadcasts: EventLiveBroadcast[]): EventLiveBroadcast[] =>
  [...broadcasts].sort((left, right) => {
    const statusDelta = Number(right.status === 'live') - Number(left.status === 'live');
    if (statusDelta !== 0) return statusDelta;
    return Date.parse(right.startedAt) - Date.parse(left.startedAt);
  });

const mergeBroadcastFeeds = (
  remoteBroadcasts: EventLiveBroadcast[],
  localBroadcasts: EventLiveBroadcast[],
): EventLiveBroadcast[] => {
  const merged = new Map<string, EventLiveBroadcast>();

  localBroadcasts.forEach((broadcast) => {
    merged.set(broadcast.id, broadcast);
  });

  remoteBroadcasts.forEach((broadcast) => {
    merged.set(broadcast.id, broadcast);
  });

  return sortBroadcasts([...merged.values()]);
};

const isLocalBroadcastId = (broadcastId: string): boolean =>
  broadcastId.startsWith(LOCAL_BROADCAST_PREFIX);

const shouldFallbackToLocal = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status === 404 || status >= 500;
};

export async function listLiveBroadcastFeed(
  eventId: ID,
  options?: RemoteModeOptions,
): Promise<EventLiveBroadcast[]> {
  const localBroadcasts = await listLocalBroadcasts(eventId);

  if (!options?.preferRemote) {
    return localBroadcasts;
  }

  try {
    const remoteBroadcasts = await LiveBroadcasts.listByEvent(eventId);
    return mergeBroadcastFeeds(remoteBroadcasts, localBroadcasts);
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      return localBroadcasts;
    }
    throw error;
  }
}

export async function startLiveBroadcastSession(
  input: EventLiveBroadcastCreateInput,
  options?: RemoteModeOptions,
): Promise<CreateLiveBroadcastMutationResult> {
  if (!options?.preferRemote) {
    const broadcast = await createLocalBroadcast(input);
    return { broadcast, source: 'local' };
  }

  const broadcast = await LiveBroadcasts.start(input);
  return { broadcast, source: 'remote' };
}

export async function endLiveBroadcastSession(
  input: {
    eventId: ID;
    broadcastId: string;
    broadcasterPartyId?: ID | null;
  },
  options?: RemoteModeOptions,
): Promise<LiveBroadcastMutationResult> {
  if (!options?.preferRemote || isLocalBroadcastId(input.broadcastId)) {
    await endLocalBroadcast(input);
    return { source: 'local' };
  }

  await LiveBroadcasts.end(input.eventId, input.broadcastId, input.broadcasterPartyId);
  return { source: 'remote' };
}

export async function heartbeatLiveBroadcastSession(
  input: EventLiveBroadcastHeartbeatInput,
  options?: RemoteModeOptions,
): Promise<LiveBroadcastMutationResult> {
  if (!options?.preferRemote || isLocalBroadcastId(input.broadcastId)) {
    await heartbeatLocalBroadcast(input);
    return { source: 'local' };
  }

  await LiveBroadcasts.heartbeat(input);
  return { source: 'remote' };
}
