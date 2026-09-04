import { get } from './client';

export type ReputationCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  defaultPosition: number;
  institutionalWeight: number;
  version: number;
};

export const Reputation = {
  categories: (locale: 'es' | 'en' = 'es') =>
    get<ReputationCategory[]>(`/reputation/categories?locale=${locale}`),
};
