import { get, post, put } from './client';
import type { components } from './generated/types';

export type MerchReputationSummary = components['schemas']['MerchReputationSummary'];
export type MerchReviewEligibility = Omit<
  components['schemas']['MerchReviewEligibility'],
  'storeReview' | 'productLines'
> & {
  storeReview: {
    eligible: boolean;
    state: 'available' | 'edit_available' | 'period_expired';
    reviewId?: string | null;
    currentRevision: number;
    deadline?: string | null;
  };
  productLines: Array<{
    lineId: string;
    productId: string;
    productName: string;
    fulfillmentState: string;
    eligible: boolean;
    state: 'available' | 'edit_available' | 'period_expired';
    reviewId?: string | null;
    currentRevision: number;
  }>;
};
export type MerchReviewSubmit = components['schemas']['MerchReviewSubmit'];
export type MerchReputationPriorities = components['schemas']['MerchReputationPriorities'];
export type MerchNotificationPreferences = components['schemas']['MerchNotificationPreferences'];

export const createMerchReviewKey = () =>
  'mobile-merch-review-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);

const idempotency = (key = createMerchReviewKey()) => ({
  headers: { 'Idempotency-Key': key },
});

export const MerchReputation = {
  artistStores: (artistPartyId: string | number) =>
    get<MerchReputationSummary[]>('/merch/artists/' + encodeURIComponent(String(artistPartyId)) + '/stores'),
  store: (storeId: string) =>
    get<MerchReputationSummary>('/merch/stores/' + encodeURIComponent(storeId) + '/reputation'),
  product: (productId: string) =>
    get<MerchReputationSummary>('/merch/products/' + encodeURIComponent(productId) + '/reputation'),
  eligibility: (orderId: string) =>
    get<MerchReviewEligibility>('/merch/orders/' + encodeURIComponent(orderId) + '/reviews/eligibility'),
  submitStore: (orderId: string, body: MerchReviewSubmit, key?: string) =>
    put<components['schemas']['MerchReviewMutation']>(
      '/merch/orders/' + encodeURIComponent(orderId) + '/store-review',
      body,
      idempotency(key),
    ),
  submitProduct: (orderId: string, lineId: string, body: MerchReviewSubmit, key?: string) =>
    put<components['schemas']['MerchReviewMutation']>(
      '/merch/orders/' + encodeURIComponent(orderId) + '/lines/' + encodeURIComponent(lineId) + '/product-review',
      body,
      idempotency(key),
    ),
  report: (body: components['schemas']['MerchContentReport'], key?: string) =>
    post<Record<string, unknown>>('/merch/reputation/reports', body, idempotency(key)),
  appeal: (decisionId: string, appealGrounds: string, key?: string) =>
    post<Record<string, unknown>>(
      '/merch/reputation/decisions/' + encodeURIComponent(decisionId) + '/appeal',
      { appealGrounds },
      idempotency(key),
    ),
  priorities: (subjectKind: 'store' | 'product') =>
    get<MerchReputationPriorities>('/merch/reputation/preferences/' + subjectKind),
  savePriorities: (
    subjectKind: 'store' | 'product',
    orderedDimensionCodes: string[],
    priorityExpectedRevision: number,
    key?: string,
  ) => put<MerchReputationPriorities>(
    '/merch/reputation/preferences/' + subjectKind,
    { orderedDimensionCodes, priorityExpectedRevision },
    idempotency(key),
  ),
  suggestCategory: (
    body: components['schemas']['MerchCategorySuggestionSubmit'],
    key?: string,
  ) => post<Record<string, unknown>>(
    '/merch/reputation/category-suggestions',body,idempotency(key),
  ),
  notificationPreferences: () =>
    get<MerchNotificationPreferences>('/merch/reputation/notification-preferences'),
  saveNotificationPreferences: (body: MerchNotificationPreferences) =>
    put<MerchNotificationPreferences>('/merch/reputation/notification-preferences', body),
};
