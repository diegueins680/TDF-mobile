import { get, patch, post } from './client';
import type { components } from './generated/types';

export type OperationsWorkItem = components['schemas']['OperationsWorkItem'];
export type OperationsWorkItemDetail = components['schemas']['OperationsWorkItemDetail'];
export type OperationsWorkItemPage = components['schemas']['OperationsWorkItemPage'];
export type OperationsStatus = components['schemas']['OperationsStatus'];
export type OperationsPriority = components['schemas']['OperationsPriority'];
export type OperationsNoteCreate = components['schemas']['OperationsNoteCreate'];
export type OperationsAssignmentCommand = components['schemas']['OperationsAssignmentCommand'];
export type OperationsTransitionCommand = components['schemas']['OperationsTransitionCommand'];
export type OperationsPushSubscriptionCreate = components['schemas']['OperationsPushSubscriptionCreate'];
export type OperationsPushSubscription = components['schemas']['OperationsPushSubscription'];

export type OperationsFilters = {
  search?: string;
  seen?: boolean;
  status?: OperationsStatus;
  priority?: OperationsPriority;
  slaState?: string;
  assigneePartyId?: number;
  entityType?: string;
  sourceChannel?: string;
  cursor?: string;
  limit?: number;
};

const buildQuery = (filters: OperationsFilters): string => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key === 'search' ? 'q' : key, String(value));
  });
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
};

const newRequestId = (): string => {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (randomUuid) return randomUuid.call(globalThis.crypto);
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const listOperationsWorkItems = (filters: OperationsFilters = {}) =>
  get<OperationsWorkItemPage>(`/operations/work-items${buildQuery({ limit: 40, ...filters })}`);

export const getOperationsWorkItem = (workItemId: string) =>
  get<OperationsWorkItemDetail>(`/operations/work-items/${encodeURIComponent(workItemId)}`);

export const markOperationsWorkItemSeen = (
  workItemId: string,
  expectedVersion: number,
) => patch<OperationsWorkItem>(`/operations/work-items/${encodeURIComponent(workItemId)}/seen`, {
  expectedVersion,
  requestId: newRequestId(),
  sourceClient: 'tdf-mobile',
});

export const transitionOperationsWorkItem = (
  workItemId: string,
  command: Omit<OperationsTransitionCommand, 'requestId' | 'sourceClient'>,
) => patch<OperationsWorkItem>(`/operations/work-items/${encodeURIComponent(workItemId)}/transition`, {
  ...command,
  requestId: newRequestId(),
  sourceClient: 'tdf-mobile',
});

export const assignOperationsWorkItem = (
  workItemId: string,
  command: Omit<OperationsAssignmentCommand, 'requestId' | 'sourceClient'>,
) => patch<OperationsWorkItem>(`/operations/work-items/${encodeURIComponent(workItemId)}/assignment`, {
  ...command,
  requestId: newRequestId(),
  sourceClient: 'tdf-mobile',
});

export const addOperationsNote = (
  workItemId: string,
  body: string,
  mentionedPartyIds: number[] = [],
) => post<OperationsWorkItemDetail['notes'][number]>(
  `/operations/work-items/${encodeURIComponent(workItemId)}/notes`,
  {
    body,
    mentionedPartyIds,
    requestId: newRequestId(),
    sourceClient: 'tdf-mobile',
  } satisfies OperationsNoteCreate,
);

export const registerOperationsPushSubscription = (command: OperationsPushSubscriptionCreate) =>
  post<OperationsPushSubscription>('/operations/push-subscriptions', command);
