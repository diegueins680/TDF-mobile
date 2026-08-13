import axios from 'axios';

import { Events } from '../api/events';
import type {
  EventMoment,
  EventMomentCommentInput,
  EventMomentCreateInput,
  EventMomentReactionOption,
  ID,
} from '../types';
import {
  addMomentComment as addLocalMomentComment,
  createEventMoment as createLocalMoment,
  listEventMoments as listLocalMoments,
  toggleMomentReaction as toggleLocalMomentReaction,
} from './eventMoments';

type RemoteModeOptions = {
  preferRemote?: boolean;
};

export type MomentMutationResult = {
  source: 'remote' | 'local';
  fallbackReason?: string;
};

export type CreateMomentMutationResult = MomentMutationResult & {
  moment: EventMoment;
};

const LOCAL_MOMENT_PREFIX = 'moment-';

const sortMomentsNewestFirst = (moments: EventMoment[]): EventMoment[] =>
  [...moments].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

const mergeMomentFeeds = (remoteMoments: EventMoment[], localMoments: EventMoment[]): EventMoment[] => {
  const merged = new Map<string, EventMoment>();

  localMoments.forEach((moment) => {
    merged.set(moment.id, moment);
  });

  remoteMoments.forEach((moment) => {
    merged.set(moment.id, moment);
  });

  return sortMomentsNewestFirst([...merged.values()]);
};

const isLocalMomentId = (momentId: string): boolean => momentId.startsWith(LOCAL_MOMENT_PREFIX);

const shouldFallbackToLocal = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status === 404 || status >= 500;
};

const getFallbackReason = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message ? message : undefined;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String(error.message ?? '').trim();
    return message ? message : undefined;
  }
  return undefined;
};

export async function listMomentFeed(eventId: ID, options?: RemoteModeOptions): Promise<EventMoment[]> {
  const localMoments = await listLocalMoments(eventId);

  if (!options?.preferRemote) {
    return localMoments;
  }

  try {
    const remoteMoments = await Events.listMoments(eventId);
    return mergeMomentFeeds(remoteMoments, localMoments);
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      return localMoments;
    }
    throw error;
  }
}

export async function createMomentFeedItem(
  input: EventMomentCreateInput,
  options?: RemoteModeOptions,
): Promise<CreateMomentMutationResult> {
  if (!options?.preferRemote) {
    const moment = await createLocalMoment(input);
    return { moment, source: 'local' };
  }

  try {
    const moment = await Events.createMoment(input);
    return { moment, source: 'remote' };
  } catch (error) {
    if (!shouldFallbackToLocal(error)) {
      throw error;
    }

    const moment = await createLocalMoment(input);
    return {
      moment,
      source: 'local',
      fallbackReason: getFallbackReason(error),
    };
  }
}

export async function toggleMomentFeedReaction(input: {
  eventId: ID;
  momentId: string;
  actorKey: string;
  reaction: EventMomentReactionOption;
}, options?: RemoteModeOptions): Promise<MomentMutationResult> {
  if (!options?.preferRemote || isLocalMomentId(input.momentId)) {
    await toggleLocalMomentReaction({ ...input, reactionTypeId: input.reaction.id });
    return { source: 'local' };
  }

  try {
    await Events.reactToMoment(input.eventId, input.momentId, input.reaction);
    return { source: 'remote' };
  } catch (error) {
    if (!shouldFallbackToLocal(error)) {
      throw error;
    }

    await toggleLocalMomentReaction({ ...input, reactionTypeId: input.reaction.id });
    return {
      source: 'local',
      fallbackReason: getFallbackReason(error),
    };
  }
}

export async function addMomentFeedComment(
  input: EventMomentCommentInput,
  options?: RemoteModeOptions,
): Promise<MomentMutationResult> {
  if (!options?.preferRemote || isLocalMomentId(input.momentId)) {
    await addLocalMomentComment(input);
    return { source: 'local' };
  }

  try {
    await Events.commentOnMoment(input);
    return { source: 'remote' };
  } catch (error) {
    if (!shouldFallbackToLocal(error)) {
      throw error;
    }

    await addLocalMomentComment(input);
    return {
      source: 'local',
      fallbackReason: getFallbackReason(error),
    };
  }
}
