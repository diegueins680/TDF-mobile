import { get, put } from './client';
import type { components } from './generated/types';

export type PublicReputation = components['schemas']['PublicReputation'];

export type ReputationCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  defaultPosition: number;
  institutionalWeight: number;
  version: number;
};

export type ReputationPreferenceCategory = {
  categoryId: string;
  slug: string;
  position: number;
  weight: number;
  notApplicable: boolean;
};

export type ReputationPreference = {
  contextKind: string;
  status: 'draft' | 'active' | 'archived';
  revision: number;
  formulaVersion: string;
  categories: ReputationPreferenceCategory[];
};

export type ReputationPreferenceSave = {
  contextKind: string;
  expectedRevision: number;
  activate: boolean;
  categories: Array<Omit<ReputationPreferenceCategory, 'slug'>>;
};

export const Reputation = {
  getPublic: (partyId: number) => get<PublicReputation>(`/reputation/profiles/${encodeURIComponent(String(partyId))}`),
  categories: (locale: 'es' | 'en' = 'es') =>
    get<ReputationCategory[]>(`/reputation/categories?locale=${locale}`),
  getMyPreferences: (contextKind = 'general') =>
    get<ReputationPreference>(`/reputation/preferences?contextKind=${encodeURIComponent(contextKind)}`),
  saveMyPreferences: (input: ReputationPreferenceSave, idempotencyKey: string) =>
    put<ReputationPreference>('/reputation/preferences', input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
};
