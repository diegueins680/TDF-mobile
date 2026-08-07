import { get, patch, post } from './client';
import type { FeatureAction } from '../features/featureRegistry';

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
export type AccessRequestHistory = {
  id: number;
  transition: string;
  fromStatus: AccessRequestStatus | null;
  toStatus: AccessRequestStatus;
  note: string | null;
  createdAt: string;
};
export type AccessRequest = {
  id: number;
  requesterPartyId: number;
  featureId: string;
  action: FeatureAction;
  roleContext: string[];
  moduleContext: string[];
  status: AccessRequestStatus;
  reviewerGroup: string;
  justification: string | null;
  reviewerNotes: string | null;
  requestedAt: string;
  updatedAt: string;
  decidedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  history: AccessRequestHistory[];
};

export const listMyAccessRequests = (): Promise<AccessRequest[]> => get('/access-requests');
export const submitAccessRequest = (payload: { featureId: string; action: FeatureAction; justification: string | null }): Promise<AccessRequest> => post('/access-requests', payload);
export const cancelAccessRequest = (id: number): Promise<AccessRequest> => patch(`/access-requests/${id}/cancel`, { cancellationNote: null });
export const listAccessRequestsForReview = (status: AccessRequestStatus = 'pending'): Promise<AccessRequest[]> => get(`/access-requests/review?status=${encodeURIComponent(status)}`);
export const decideAccessRequest = (id: number, decision: 'approved' | 'rejected', notes: string | null): Promise<AccessRequest> => patch(`/access-requests/${id}/decision`, { decision, notes });
