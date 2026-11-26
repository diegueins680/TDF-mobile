// TAX-FILTER-001: pure model behind the shared location and genre filters.
// Values inside one dimension are ORed and dimensions are ANDed by the
// backend (which also expands a genre to its subgenres); this module only
// reads and writes selections, resolves labels in the viewer's language and
// orders options for display.
import type {
  TaxonomyCityOption,
  TaxonomyFacets,
  TaxonomyFilterOptions,
  TaxonomyGenreOption,
  TaxonomySelection,
} from '../../api/taxonomy';

export type TaxonomyDimension = keyof TaxonomySelection;
export type TaxonomyLanguage = 'es' | 'en';
export type TaxonomyRouteParams = Record<string, string | string[] | undefined | null>;

export const TAXONOMY_DIMENSIONS: readonly TaxonomyDimension[] = ['countryIds', 'regionIds', 'cityIds', 'genreIds'];

/** Language-independent link keys; values are taxonomy ids (shared with the web app). */
export const TAXONOMY_URL_KEYS: Record<TaxonomyDimension, string> = {
  countryIds: 'f.country',
  regionIds: 'f.region',
  cityIds: 'f.city',
  genreIds: 'f.genre',
};

/** Marks a surface whose filters are deliberately its own, even when empty. */
export const TAXONOMY_LOCAL_SCOPE_KEY = 'f.scope';
export const TAXONOMY_LOCAL_SCOPE_VALUE = 'local';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_VALUES_PER_DIMENSION = 50;

export const emptyTaxonomySelection = (): TaxonomySelection => ({ countryIds: [], regionIds: [], cityIds: [], genreIds: [] });

export const isTaxonomyId = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value.trim());

const cleanIds = (values: readonly unknown[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    if (typeof value !== 'string') return;
    const id = value.trim().toLowerCase();
    if (!UUID_PATTERN.test(id) || seen.has(id)) return;
    seen.add(id);
    result.push(id);
  });
  return result.slice(0, MAX_VALUES_PER_DIMENSION);
};

export const normalizeTaxonomySelection = (value: unknown): TaxonomySelection => {
  if (!value || typeof value !== 'object') return emptyTaxonomySelection();
  const record = value as Record<string, unknown>;
  const read = (key: TaxonomyDimension) => (Array.isArray(record[key]) ? cleanIds(record[key] as unknown[]) : []);
  return { countryIds: read('countryIds'), regionIds: read('regionIds'), cityIds: read('cityIds'), genreIds: read('genreIds') };
};

export const isTaxonomySelectionEmpty = (selection: TaxonomySelection) =>
  TAXONOMY_DIMENSIONS.every((dimension) => selection[dimension].length === 0);

export const countTaxonomyValues = (selection: TaxonomySelection) =>
  TAXONOMY_DIMENSIONS.reduce((total, dimension) => total + selection[dimension].length, 0);

export const taxonomySelectionsEqual = (left: TaxonomySelection, right: TaxonomySelection) =>
  TAXONOMY_DIMENSIONS.every((dimension) => {
    const a = [...left[dimension]].sort();
    const b = [...right[dimension]].sort();
    return a.length === b.length && a.every((value, index) => value === b[index]);
  });

/** Stable key for query caches and effect dependencies. */
export const taxonomySelectionKey = (selection: TaxonomySelection) =>
  TAXONOMY_DIMENSIONS.map((dimension) => [...selection[dimension]].sort().join(',')).join('|');

const paramValues = (value: string | string[] | undefined | null): string[] => {
  if (Array.isArray(value)) return value;
  return typeof value === 'string' ? [value] : [];
};

/** Expo Router route params (a repeated key arrives as an array). */
export const hasTaxonomyRouteState = (params: TaxonomyRouteParams) =>
  TAXONOMY_DIMENSIONS.some((dimension) => paramValues(params[TAXONOMY_URL_KEYS[dimension]]).length > 0)
  || isLocalTaxonomyScope(params);

export const isLocalTaxonomyScope = (params: TaxonomyRouteParams) =>
  paramValues(params[TAXONOMY_LOCAL_SCOPE_KEY]).includes(TAXONOMY_LOCAL_SCOPE_VALUE);

export const readTaxonomySelectionFromParams = (params: TaxonomyRouteParams): TaxonomySelection => ({
  countryIds: cleanIds(paramValues(params[TAXONOMY_URL_KEYS.countryIds])),
  regionIds: cleanIds(paramValues(params[TAXONOMY_URL_KEYS.regionIds])),
  cityIds: cleanIds(paramValues(params[TAXONOMY_URL_KEYS.cityIds])),
  genreIds: cleanIds(paramValues(params[TAXONOMY_URL_KEYS.genreIds])),
});

/** Reads the filters from a parsed link's query (e.g. `new URL(link).searchParams`). */
export const readTaxonomySelectionFromQuery = (query: { getAll: (key: string) => string[] }): TaxonomySelection => ({
  countryIds: cleanIds(query.getAll(TAXONOMY_URL_KEYS.countryIds)),
  regionIds: cleanIds(query.getAll(TAXONOMY_URL_KEYS.regionIds)),
  cityIds: cleanIds(query.getAll(TAXONOMY_URL_KEYS.cityIds)),
  genreIds: cleanIds(query.getAll(TAXONOMY_URL_KEYS.genreIds)),
});

/**
 * The selection as encoded link parts (`f.city=<id>&f.city=<id>`), ready for a
 * shared `tdf://directory?…` link. `local` marks a deliberate override.
 */
export const taxonomyLinkQuery = (selection: TaxonomySelection, local = false): string => {
  const parts = TAXONOMY_DIMENSIONS.flatMap((dimension) =>
    selection[dimension].map((id) => `${encodeURIComponent(TAXONOMY_URL_KEYS[dimension])}=${encodeURIComponent(id)}`));
  if (local) parts.push(`${encodeURIComponent(TAXONOMY_LOCAL_SCOPE_KEY)}=${TAXONOMY_LOCAL_SCOPE_VALUE}`);
  return parts.join('&');
};

export const toggleTaxonomyValue = (selection: TaxonomySelection, dimension: TaxonomyDimension, id: string): TaxonomySelection => {
  const current = selection[dimension];
  const nextValues = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
  return { ...selection, [dimension]: nextValues.slice(0, MAX_VALUES_PER_DIMENSION) };
};

export const removeTaxonomyValue = (selection: TaxonomySelection, dimension: TaxonomyDimension, id: string): TaxonomySelection => ({
  ...selection,
  [dimension]: selection[dimension].filter((value) => value !== id),
});

export const taxonomyName = (option: { nameEs?: string | null; nameEn?: string | null }, language: TaxonomyLanguage): string => {
  const preferred = language === 'en' ? option.nameEn : option.nameEs;
  const fallback = language === 'en' ? option.nameEs : option.nameEn;
  return preferred?.trim() ? preferred : (fallback ?? '');
};

/** Spanish for Spanish (and when unknown, the app default); English for every other language. */
export const resolveTaxonomyLanguage = (language: string | undefined | null): TaxonomyLanguage => {
  const normalized = language?.trim().toLowerCase();
  return !normalized || normalized.startsWith('es') ? 'es' : 'en';
};

export interface TaxonomyOption {
  id: string;
  label: string;
  /** Nesting depth for genres (0 = top level). */
  depth: number;
  /** Parent label, shown as context for cities and regions. */
  context?: string;
  /** Matching items from the backend facets; undefined when no facets are available. */
  count?: number;
}

const facetCounts = (facets: TaxonomyFacets | null | undefined, key: keyof TaxonomyFacets) => {
  const counts = new Map<string, number>();
  (facets?.[key] ?? []).forEach((item) => counts.set(item.id, item.count));
  return counts;
};

const compareLabels = (language: TaxonomyLanguage) => (a: string, b: string) =>
  a.localeCompare(b, language, { sensitivity: 'base' });

/** Genres as a depth-first tree: each parent is followed by its subgenres. */
export const genreOptions = (
  genres: readonly TaxonomyGenreOption[],
  language: TaxonomyLanguage,
  facets?: TaxonomyFacets | null,
): TaxonomyOption[] => {
  const counts = facetCounts(facets, 'genres');
  const compare = compareLabels(language);
  const known = new Set(genres.map((genre) => genre.id));
  const children = new Map<string | null, TaxonomyGenreOption[]>();
  genres.forEach((genre) => {
    const parent = genre.parentId && known.has(genre.parentId) && genre.parentId !== genre.id ? genre.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), genre]);
  });
  const result: TaxonomyOption[] = [];
  const seen = new Set<string>();
  const visit = (parent: string | null, depth: number) => {
    const items = [...(children.get(parent) ?? [])].sort((a, b) => compare(taxonomyName(a, language), taxonomyName(b, language)));
    items.forEach((genre) => {
      if (seen.has(genre.id) || depth > 8) return;
      seen.add(genre.id);
      result.push({ id: genre.id, label: taxonomyName(genre, language), depth, count: facets ? counts.get(genre.id) ?? 0 : undefined });
      visit(genre.id, depth + 1);
    });
  };
  visit(null, 0);
  return result;
};

/**
 * Countries, regions and cities in display order. Regions are narrowed to the
 * selected countries and cities to the selected countries and regions so the
 * lists stay short; a selected value is always kept.
 */
export const locationOptions = (
  options: TaxonomyFilterOptions,
  selection: TaxonomySelection,
  language: TaxonomyLanguage,
  facets?: TaxonomyFacets | null,
) => {
  const compare = compareLabels(language);
  const countryCounts = facetCounts(facets, 'countries');
  const regionCounts = facetCounts(facets, 'regions');
  const cityCounts = facetCounts(facets, 'cities');
  const countryNames = new Map(options.countries.map((country) => [country.id, taxonomyName(country, language)]));
  const regionNames = new Map(options.regions.map((region) => [region.id, taxonomyName(region, language)]));
  const withCount = (counts: Map<string, number>, id: string) => (facets ? counts.get(id) ?? 0 : undefined);
  const byLabel = (a: TaxonomyOption, b: TaxonomyOption) => compare(a.label, b.label);
  // Countries with matching items first, then the rest alphabetically.
  const countries: TaxonomyOption[] = options.countries
    .map((country) => ({ id: country.id, label: taxonomyName(country, language), depth: 0, count: withCount(countryCounts, country.id) }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || byLabel(a, b));
  const regions: TaxonomyOption[] = options.regions
    .filter((region) => selection.countryIds.length === 0 || selection.countryIds.includes(region.countryId) || selection.regionIds.includes(region.id))
    .map((region) => ({ id: region.id, label: taxonomyName(region, language), depth: 0, context: countryNames.get(region.countryId), count: withCount(regionCounts, region.id) }))
    .sort(byLabel);
  const cityInScope = (city: TaxonomyCityOption) =>
    selection.cityIds.includes(city.id)
    || ((selection.countryIds.length === 0 || selection.countryIds.includes(city.countryId))
      && (selection.regionIds.length === 0 || (city.regionId != null && selection.regionIds.includes(city.regionId))));
  const cities: TaxonomyOption[] = options.cities
    .filter(cityInScope)
    .map((city) => ({
      id: city.id,
      label: taxonomyName(city, language),
      depth: 0,
      context: (city.regionId ? regionNames.get(city.regionId) : undefined) ?? countryNames.get(city.countryId),
      count: withCount(cityCounts, city.id),
    }))
    .sort(byLabel);
  return { countries, regions, cities };
};

export interface TaxonomyChip {
  dimension: TaxonomyDimension;
  id: string;
  label: string;
}

/** Active selections as removable chips, in dimension order. Unknown ids keep a placeholder label. */
export const taxonomyChips = (
  selection: TaxonomySelection,
  options: TaxonomyFilterOptions | null | undefined,
  language: TaxonomyLanguage,
  unknownLabel: string,
): TaxonomyChip[] => {
  const lookup: Record<TaxonomyDimension, Map<string, string>> = {
    countryIds: new Map((options?.countries ?? []).map((item) => [item.id, taxonomyName(item, language)])),
    regionIds: new Map((options?.regions ?? []).map((item) => [item.id, taxonomyName(item, language)])),
    cityIds: new Map((options?.cities ?? []).map((item) => [item.id, taxonomyName(item, language)])),
    genreIds: new Map((options?.genres ?? []).map((item) => [item.id, taxonomyName(item, language)])),
  };
  return TAXONOMY_DIMENSIONS.flatMap((dimension) =>
    selection[dimension].map((id) => ({ dimension, id, label: lookup[dimension].get(id) || unknownLabel })));
};

const normalizeName = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Match a free-text city ("quito ") to exactly one city option by its Spanish or English name. */
export const matchCityByName = (cities: readonly TaxonomyCityOption[], rawCity: string | null | undefined): TaxonomyCityOption | null => {
  const needle = normalizeName(rawCity ?? '');
  if (!needle) return null;
  const matches = cities.filter((city) => normalizeName(city.nameEs) === needle || normalizeName(city.nameEn) === needle);
  return matches.length === 1 ? matches[0]! : null;
};

/**
 * The city a never-initialized shared filter set starts with: only the city the
 * viewer chose in the old single-city directory picker. Nobody is filtered to a
 * city they did not pick (the shared set also drives events).
 */
export const defaultCityFor = (
  cities: readonly TaxonomyCityOption[],
  storedCityId: string | null | undefined,
): TaxonomyCityOption | null =>
  cities.find((city) => storedCityId && city.id === storedCityId.trim().toLowerCase()) ?? null;
