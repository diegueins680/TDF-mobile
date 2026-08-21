import { get, post } from './client';
import type { components } from './generated/types';

export type ExperienceReviewTargetKind = components['schemas']['ExperienceReviewTargetKind'];
export type ExperienceReviewPage = components['schemas']['ExperienceReviewPage'];
export type ExperienceReview = components['schemas']['ExperienceReview'];
export type ExperienceReviewEligibility = components['schemas']['ExperienceReviewEligibility'];
export type ExperienceReviewCreate = components['schemas']['ExperienceReviewCreate'];
export type DirectoryReviewPage = components['schemas']['DirectoryReviewPage'];
export type DirectoryReviewEligibility = components['schemas']['DirectoryReviewEligibility'];
export type DirectoryReviewCreate = components['schemas']['DirectoryReviewCreate'];
export type DirectoryReview = components['schemas']['DirectoryReview'];
export type PublicDirectoryProfile = components['schemas']['PublicDirectoryProfile'];
export type ReportCreate = components['schemas']['ReportCreate'];

export const createReviewIdempotencyKey = () => {
  const random = Math.random().toString(36).slice(2);
  return `mobile-review-${Date.now().toString(36)}-${random}`;
};

export const Reviews = {
  list: (targetKind: ExperienceReviewTargetKind, targetId: string, cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return get<ExperienceReviewPage>(
      `/reviews/${encodeURIComponent(targetKind)}/${encodeURIComponent(targetId)}?${params.toString()}`,
    );
  },
  eligibility: (targetKind: ExperienceReviewTargetKind, targetId: string) => {
    const params = new URLSearchParams({ targetKind, targetId });
    return get<ExperienceReviewEligibility[]>(`/reviews/eligibility?${params.toString()}`);
  },
  create: (body: ExperienceReviewCreate, idempotencyKey = createReviewIdempotencyKey()) =>
    post<ExperienceReview>('/reviews', body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  listDirectoryProfile: (slug: string, cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return get<DirectoryReviewPage>(
      `/directory/profiles/${encodeURIComponent(slug)}/reviews?${params.toString()}`,
    );
  },
  getDirectoryProfile: (slug: string) =>
    get<PublicDirectoryProfile>(`/directory/profiles/${encodeURIComponent(slug)}`),
  getDirectoryProfileByParty: (partyId: string) =>
    get<PublicDirectoryProfile>(`/directory/party-profiles/${encodeURIComponent(partyId)}`),
  directoryEligibility: () =>
    get<DirectoryReviewEligibility[]>('/directory/review-eligibility'),
  createDirectory: (body: DirectoryReviewCreate, idempotencyKey = createReviewIdempotencyKey()) =>
    post<DirectoryReview>('/directory/reviews', body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  report: (reviewId: string, idempotencyKey = createReviewIdempotencyKey()) =>
    post<unknown>('/directory/reports', {
      targetKind: 'review',
      targetId: reviewId,
      reasonCode: 'inappropriate_content',
    } satisfies ReportCreate, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
};
