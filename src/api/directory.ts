import type { components } from './generated/types';
import { get, patch, post, put } from './client';

export type DirectoryEntityType = components['schemas']['DirectoryEntityType'];
export type DirectorySearchItem = components['schemas']['DirectorySearchItem'];
export type DirectorySearchResponse = components['schemas']['DirectorySearchResponse'];
export type DirectoryTaxonomies = components['schemas']['DirectoryTaxonomies'];
export type ManagedDirectoryProfile = components['schemas']['ManagedDirectoryProfile'];
export type DirectoryProfileUpsert = components['schemas']['DirectoryProfileUpsert'];
export type DirectoryPortfolioItem = components['schemas']['DirectoryPortfolioItem'];
export type DirectoryProfileLink = components['schemas']['DirectoryProfileLink'];
export type ManagedClassified = components['schemas']['ManagedClassified'];
export type ApplicationCreate = components['schemas']['ApplicationCreate'];
export type DirectoryContact = components['schemas']['DirectoryContact'];
export type DirectoryInvitation = components['schemas']['DirectoryInvitation'];
export type DirectoryReviewPage = components['schemas']['DirectoryReviewPage'];
export type DirectoryReviewEligibility = components['schemas']['DirectoryReviewEligibility'];
export type DirectoryReview = components['schemas']['DirectoryReview'];

export interface DirectorySearchQuery {
  q?: string;
  entityType?: DirectoryEntityType;
  cityId?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  professionId?: string;
  serviceId?: string;
  instrumentId?: string;
  genreId?: string;
  remote?: boolean;
  available?: boolean;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: number;
}

const queryString = (query: DirectorySearchQuery): string => {
  const entries = Object.entries(query).flatMap(([key, value]) => (
    value === undefined || value === null || value === ''
      ? []
      : [`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`]
  ));
  return entries.length ? `?${entries.join('&')}` : '';
};

const idempotencyConfig = (key?: string) => ({
  headers: {
    'Idempotency-Key': key ?? `mobile-directory-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

export const Directory = {
  search: (query: DirectorySearchQuery = {}) =>
    get<DirectorySearchResponse>(`/directory/search${queryString(query)}`),
  taxonomies: (locale = 'es') =>
    get<DirectoryTaxonomies>(`/directory/taxonomies?locale=${encodeURIComponent(locale)}`),
  profile: (slug: string) =>
    get<components['schemas']['PublicDirectoryProfile']>(`/directory/profiles/${encodeURIComponent(slug)}`),
  profileReviews: (slug: string, cursor?: string, limit = 20) =>
    get<DirectoryReviewPage>(`/directory/profiles/${encodeURIComponent(slug)}/reviews${queryString({ cursor, limit })}`),
  classified: (slug: string) =>
    get<components['schemas']['PublicClassified']>(`/directory/classifieds/${encodeURIComponent(slug)}`),
  event: (id: string) =>
    get<components['schemas']['PublicDirectoryEvent']>(`/directory/events/${encodeURIComponent(id)}`),
  venue: (id: string) =>
    get<components['schemas']['PublicDirectoryVenue']>(`/directory/venues/${encodeURIComponent(id)}`),
  managedProfiles: () => get<ManagedDirectoryProfile[]>('/directory/profiles'),
  managedClassifieds: () => get<ManagedClassified[]>('/directory/classifieds'),
  setAgeAssurance: (body: components['schemas']['AgeAssuranceRequest']) =>
    put<Record<string, unknown>>('/directory/age-assurance', body),
  createProfile: (body: components['schemas']['DirectoryProfileUpsert'], idempotencyKey?: string) =>
    post<ManagedDirectoryProfile>('/directory/profiles', body, idempotencyConfig(idempotencyKey)),
  updateProfile: (profileId: string, body: components['schemas']['DirectoryProfileUpsert']) =>
    put<ManagedDirectoryProfile>(`/directory/profiles/${encodeURIComponent(profileId)}`, body),
  transitionProfile: (profileId: string, status: string) =>
    patch<ManagedDirectoryProfile>(`/directory/profiles/${encodeURIComponent(profileId)}/status`, { status }),
  createClassified: (body: components['schemas']['ClassifiedCreate'], idempotencyKey?: string) =>
    post<ManagedClassified>('/directory/classifieds', body, idempotencyConfig(idempotencyKey)),
  transitionClassified: (classifiedId: string, status: string) =>
    patch<ManagedClassified>(`/directory/classifieds/${encodeURIComponent(classifiedId)}/status`, { status }),
  apply: (classifiedId: string, body: ApplicationCreate, idempotencyKey?: string) =>
    post<components['schemas']['ClassifiedApplication']>(
      `/directory/classifieds/${encodeURIComponent(classifiedId)}/applications`,
      body,
      idempotencyConfig(idempotencyKey),
    ),
  contact: (body: DirectoryContact, idempotencyKey?: string) =>
    post<Record<string, unknown>>('/directory/contact', body, idempotencyConfig(idempotencyKey)),
  reviewEligibility: (authorProfileId?: string) =>
    get<DirectoryReviewEligibility[]>(`/directory/review-eligibility${authorProfileId ? `?authorProfileId=${encodeURIComponent(authorProfileId)}` : ''}`),
  createReview: (body: components['schemas']['DirectoryReviewCreate'], idempotencyKey?: string) =>
    post<DirectoryReview>('/directory/reviews', body, idempotencyConfig(idempotencyKey)),
  invitations: () => get<DirectoryInvitation[]>('/directory/invitations'),
  invite: (body: components['schemas']['InvitationCreate'], idempotencyKey?: string) =>
    post<DirectoryInvitation>('/directory/invitations', body, idempotencyConfig(idempotencyKey)),
  transitionInvitation: (invitationId: string, status: string) =>
    patch<DirectoryInvitation>(`/directory/invitations/${encodeURIComponent(invitationId)}/status`, { status }),
  saveSearch: (body: components['schemas']['SavedSearchCreate'], idempotencyKey?: string) =>
    post<components['schemas']['SavedDirectorySearch']>(
      '/directory/saved-searches',
      body,
      idempotencyConfig(idempotencyKey),
    ),
  report: (body: components['schemas']['ReportCreate'], idempotencyKey?: string) =>
    post<Record<string, unknown>>('/directory/reports', body, idempotencyConfig(idempotencyKey)),
};
