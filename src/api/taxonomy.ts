import { get, post } from './client';
import type { components } from './generated/types';

// TAX-FILTER-001 / TAX-GENRE-SUGGESTION-001.
export type TaxonomyFilterOptions = components['schemas']['TaxonomyFilterOptions'];
export type TaxonomyCountryOption = components['schemas']['TaxonomyCountryOption'];
export type TaxonomyRegionOption = components['schemas']['TaxonomyRegionOption'];
export type TaxonomyCityOption = components['schemas']['TaxonomyCityOption'];
export type TaxonomyGenreOption = components['schemas']['TaxonomyGenreOption'];
export type TaxonomyFacets = components['schemas']['TaxonomyFacets'];
export type GenreSuggestionRequest = components['schemas']['GenreSuggestionRequest'];
export type GenreSuggestionCheck = components['schemas']['GenreSuggestionCheck'];
export type GenreSuggestion = components['schemas']['GenreSuggestion'];
export type GenreSuggestionSubmission = components['schemas']['GenreSuggestionSubmission'];

export interface TaxonomySelection {
  countryIds: string[];
  regionIds: string[];
  cityIds: string[];
  genreIds: string[];
}

export const TAXONOMY_PARAM_KEYS = ['countryIds', 'regionIds', 'cityIds', 'genreIds'] as const;

/**
 * Append the four repeatable taxonomy parameters (`cityIds=a&cityIds=b`) to
 * anything with an `append` method, such as URLSearchParams.
 */
export const appendTaxonomyParams = <T extends { append: (key: string, value: string) => void }>(
  params: T,
  selection?: Partial<TaxonomySelection> | null,
): T => {
  if (!selection) return params;
  TAXONOMY_PARAM_KEYS.forEach((key) => {
    (selection[key] ?? []).forEach((value) => {
      if (value) params.append(key, value);
    });
  });
  return params;
};

/** The same parameters as encoded `key=value` parts, for hand-built query strings. */
export const taxonomyQueryParts = (selection?: Partial<TaxonomySelection> | null): string[] => {
  const parts: string[] = [];
  appendTaxonomyParams(
    { append: (key: string, value: string) => { parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`); } },
    selection,
  );
  return parts;
};

const withQuery = (path: string, parts: string[]) => (parts.length ? `${path}?${parts.join('&')}` : path);

export interface EventFacetFilters {
  city?: string;
  scope?: 'subscribed' | 'all';
  startAfter?: string;
  eventTypeId?: string;
}

export const Taxonomy = {
  filterOptions: () => get<TaxonomyFilterOptions>('/taxonomy/filter-options'),
  eventFacets: (selection: TaxonomySelection, filters: EventFacetFilters = {}) => {
    const parts: string[] = [];
    const add = (key: string, value?: string) => {
      const trimmed = value?.trim();
      if (trimmed) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(trimmed)}`);
    };
    add('city', filters.city);
    add('scope', filters.scope);
    add('start_after', filters.startAfter);
    add('event_type_id', filters.eventTypeId);
    return get<TaxonomyFacets>(withQuery('/social-events/events/facets', [...parts, ...taxonomyQueryParts(selection)]));
  },
  radioFacets: (selection: TaxonomySelection) =>
    get<TaxonomyFacets>(withQuery('/radio/streams/facets', taxonomyQueryParts(selection))),
  musicReleaseFacets: (selection: TaxonomySelection) =>
    get<TaxonomyFacets>(withQuery('/music/facets/releases', taxonomyQueryParts(selection))),
  checkGenreSuggestion: (body: GenreSuggestionRequest) =>
    post<GenreSuggestionCheck>('/genres/suggestions/check', body),
  submitGenreSuggestion: (body: GenreSuggestionRequest) =>
    post<GenreSuggestionSubmission>('/genres/suggestions', body),
  myGenreSuggestions: () => get<GenreSuggestion[]>('/genres/suggestions/mine'),
};
