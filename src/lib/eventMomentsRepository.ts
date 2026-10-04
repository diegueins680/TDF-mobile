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
  storageScope?: string;
};

export type MomentMutationResult = {
  source: 'remote' | 'local';
  fallbackReason?: string;
  selected?: boolean;
};

export type CreateMomentMutationResult = MomentMutationResult & {
  moment: EventMoment;
};

const LOCAL_MOMENT_PREFIX = 'moment-';

const sortMomentsNewestFirst = (moments: EventMoment[]): EventMoment[] =>
  [...moments].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

const isLocalMomentId = (momentId: string): boolean => momentId.startsWith(LOCAL_MOMENT_PREFIX);

export async function listMomentFeed(eventId: ID, options?: RemoteModeOptions): Promise<EventMoment[]> {
  if (!options?.preferRemote) return listLocalMoments(eventId, options?.storageScope);
  return sortMomentsNewestFirst(await Events.listMoments(eventId));
}

export async function createMomentFeedItem(input: EventMomentCreateInput, options?: RemoteModeOptions): Promise<CreateMomentMutationResult> {
  if (!options?.preferRemote) return { moment: await createLocalMoment(input, options?.storageScope), source: 'local' };
  return { moment: await Events.createMoment(input), source: 'remote' };
}

export async function toggleMomentFeedReaction(input: {
  eventId: ID; momentId: string; actorKey: string; reaction: EventMomentReactionOption; active?: boolean;
}, options?: RemoteModeOptions): Promise<MomentMutationResult> {
  if (isLocalMomentId(input.momentId)) {
    const moments = await toggleLocalMomentReaction({ ...input, reactionTypeId: input.reaction.id }, options?.storageScope);
    return { source: 'local', selected: moments.find((moment) => moment.id === input.momentId)?.reactions[input.reaction.id]?.includes(input.actorKey) === true };
  }
  if (!options?.preferRemote) throw new Error('Inicia sesión para reaccionar a esta publicación.');
  const moment = await Events.reactToMoment(input.eventId, input.momentId, input.reaction, input.active);
  return { source: 'remote', selected: moment.reactions[input.reaction.id]?.includes(input.actorKey) === true };
}

export async function addMomentFeedComment(input: EventMomentCommentInput, options?: RemoteModeOptions): Promise<MomentMutationResult> {
  if (isLocalMomentId(input.momentId)) { await addLocalMomentComment(input, options?.storageScope); return { source: 'local' }; }
  if (!options?.preferRemote) throw new Error('Inicia sesión para comentar en esta publicación.');
  await Events.commentOnMoment(input); return { source: 'remote' };
}
