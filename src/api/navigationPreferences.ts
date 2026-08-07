import { get, post, put } from './client';

export type NavigationPreference = {
  featureId: string;
  favorite: boolean;
  pinned: boolean;
  pinOrder: number | null;
  lastVisitedAt: string | null;
  useCount: number;
  updatedAt: string;
};

export const listNavigationPreferences = (): Promise<NavigationPreference[]> => get('/navigation/preferences');
export const updateNavigationPreference = (
  featureId: string,
  input: Pick<NavigationPreference, 'favorite' | 'pinned' | 'pinOrder'>,
): Promise<NavigationPreference> => put(`/navigation/preferences/${encodeURIComponent(featureId)}`, input);
export const recordFeatureVisit = (featureId: string): Promise<NavigationPreference> =>
  post(`/navigation/preferences/${encodeURIComponent(featureId)}/visit`, {});
