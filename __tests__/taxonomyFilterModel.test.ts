import { appendTaxonomyParams, taxonomyQueryParts, type TaxonomyFilterOptions } from '../src/api/taxonomy';
import {
  defaultCityFor,
  emptyTaxonomySelection,
  genreOptions,
  hasTaxonomyRouteState,
  isLocalTaxonomyScope,
  locationOptions,
  matchCityByName,
  normalizeTaxonomySelection,
  readTaxonomySelectionFromParams,
  readTaxonomySelectionFromQuery,
  removeTaxonomyValue,
  resolveTaxonomyLanguage,
  taxonomyChips,
  taxonomyLinkQuery,
  taxonomyName,
  taxonomySelectionsEqual,
  toggleTaxonomyValue,
} from '../src/features/taxonomyFilters/taxonomyFilterModel';

const id = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const EC = id('1');
const CO = id('2');
const PICHINCHA = id('3');
const QUITO = id('4');
const BOGOTA = id('5');
const ROCK = id('6');
const INDIE_ROCK = id('7');
const CUMBIA = id('8');

const options: TaxonomyFilterOptions = {
  countries: [
    { id: EC, code: 'EC', nameEs: 'Ecuador', nameEn: 'Ecuador' },
    { id: CO, code: 'CO', nameEs: 'Colombia', nameEn: 'Colombia' },
  ],
  regions: [{ id: PICHINCHA, countryId: EC, code: 'EC-P', type: 'province', nameEs: 'Pichincha', nameEn: 'Pichincha' }],
  cities: [
    { id: QUITO, countryId: EC, regionId: PICHINCHA, code: 'quito-ec-p', nameEs: 'Quito', nameEn: 'Quito', latitude: -0.18, longitude: -78.47 },
    { id: BOGOTA, countryId: CO, regionId: null, code: 'bogota-co', nameEs: 'Bogotá', nameEn: 'Bogota', latitude: 4.7, longitude: -74.07 },
  ],
  genres: [
    { id: INDIE_ROCK, parentId: ROCK, code: 'indie-rock', nameEs: 'Rock independiente', nameEn: 'Indie rock' },
    { id: ROCK, parentId: null, code: 'rock', nameEs: 'Rock', nameEn: 'Rock' },
    { id: CUMBIA, parentId: null, code: 'cumbia', nameEs: 'Cumbia', nameEn: '' },
  ],
};

describe('taxonomy selection normalization', () => {
  it('lowercases, dedupes and drops values that are not taxonomy ids', () => {
    expect(normalizeTaxonomySelection({
      cityIds: [QUITO.toUpperCase(), QUITO, 'quito', 42, ` ${BOGOTA} `],
      genreIds: 'rock',
    })).toEqual({ countryIds: [], regionIds: [], cityIds: [QUITO, BOGOTA], genreIds: [] });
    expect(normalizeTaxonomySelection(null)).toEqual(emptyTaxonomySelection());
  });

  it('compares selections regardless of order', () => {
    expect(taxonomySelectionsEqual(
      { ...emptyTaxonomySelection(), cityIds: [QUITO, BOGOTA] },
      { ...emptyTaxonomySelection(), cityIds: [BOGOTA, QUITO] },
    )).toBe(true);
  });

  it('toggles and removes values within one dimension', () => {
    const one = toggleTaxonomyValue(emptyTaxonomySelection(), 'genreIds', ROCK);
    const two = toggleTaxonomyValue(one, 'genreIds', CUMBIA);
    expect(two.genreIds).toEqual([ROCK, CUMBIA]);
    expect(toggleTaxonomyValue(two, 'genreIds', ROCK).genreIds).toEqual([CUMBIA]);
    expect(removeTaxonomyValue(two, 'genreIds', CUMBIA).genreIds).toEqual([ROCK]);
  });
});

describe('taxonomy link params', () => {
  it('reads repeated f.* route params and the local scope marker', () => {
    const params = { 'f.city': [QUITO, BOGOTA], 'f.genre': ROCK, 'f.scope': 'local', q: 'bajista' };
    expect(readTaxonomySelectionFromParams(params)).toEqual({
      countryIds: [], regionIds: [], cityIds: [QUITO, BOGOTA], genreIds: [ROCK],
    });
    expect(hasTaxonomyRouteState(params)).toBe(true);
    expect(isLocalTaxonomyScope(params)).toBe(true);
    expect(hasTaxonomyRouteState({ q: 'bajista' })).toBe(false);
    expect(hasTaxonomyRouteState({ 'f.scope': 'local' })).toBe(true);
  });

  it('writes a link query that reads back to the same selection', () => {
    const selection = { ...emptyTaxonomySelection(), countryIds: [EC], genreIds: [ROCK, CUMBIA] };
    const query = taxonomyLinkQuery(selection, true);
    expect(query).toBe(`f.country=${EC}&f.genre=${ROCK}&f.genre=${CUMBIA}&f.scope=local`);
    expect(readTaxonomySelectionFromQuery(new URLSearchParams(query))).toEqual(selection);
  });

  it('appends repeatable API parameters', () => {
    const selection = { ...emptyTaxonomySelection(), cityIds: [QUITO, BOGOTA], genreIds: [ROCK] };
    expect(appendTaxonomyParams(new URLSearchParams('scope=all'), selection).toString())
      .toBe(`scope=all&cityIds=${QUITO}&cityIds=${BOGOTA}&genreIds=${ROCK}`);
    expect(taxonomyQueryParts(selection)).toEqual([`cityIds=${QUITO}`, `cityIds=${BOGOTA}`, `genreIds=${ROCK}`]);
    expect(taxonomyQueryParts(null)).toEqual([]);
  });
});

describe('taxonomy labels', () => {
  it('uses the viewer language and falls back to the other name', () => {
    expect(resolveTaxonomyLanguage('es-EC')).toBe('es');
    expect(resolveTaxonomyLanguage('pt')).toBe('en');
    expect(resolveTaxonomyLanguage(undefined)).toBe('es');
    expect(taxonomyName(options.genres[0]!, 'en')).toBe('Indie rock');
    expect(taxonomyName(options.genres[0]!, 'es')).toBe('Rock independiente');
    expect(taxonomyName(options.genres[2]!, 'en')).toBe('Cumbia');
  });

  it('orders genres as a tree with subgenres indented under their parent', () => {
    const facets = { genres: [{ id: ROCK, count: 12 }, { id: INDIE_ROCK, count: 4 }] };
    expect(genreOptions(options.genres, 'en', facets)).toEqual([
      { id: CUMBIA, label: 'Cumbia', depth: 0, count: 0 },
      { id: ROCK, label: 'Rock', depth: 0, count: 12 },
      { id: INDIE_ROCK, label: 'Indie rock', depth: 1, count: 4 },
    ]);
    expect(genreOptions(options.genres, 'es')[0]?.count).toBeUndefined();
  });

  it('narrows regions and cities to the selected countries but keeps selected values', () => {
    const selection = { ...emptyTaxonomySelection(), countryIds: [EC] };
    const lists = locationOptions(options, selection, 'es', { countries: [{ id: CO, count: 3 }] });
    expect(lists.countries.map((item) => item.id)).toEqual([CO, EC]);
    expect(lists.regions.map((item) => item.id)).toEqual([PICHINCHA]);
    expect(lists.cities).toEqual([{ id: QUITO, label: 'Quito', depth: 0, context: 'Pichincha', count: 0 }]);
    const keepsSelected = locationOptions(options, { ...selection, cityIds: [BOGOTA] }, 'es');
    expect(keepsSelected.cities.map((item) => item.id)).toEqual([BOGOTA, QUITO]);
  });

  it('builds removable chips in dimension order with a placeholder for unknown ids', () => {
    const selection = { ...emptyTaxonomySelection(), genreIds: [ROCK], cityIds: [QUITO, id('9')] };
    expect(taxonomyChips(selection, options, 'es', 'Valor no disponible')).toEqual([
      { dimension: 'cityIds', id: QUITO, label: 'Quito' },
      { dimension: 'cityIds', id: id('9'), label: 'Valor no disponible' },
      { dimension: 'genreIds', id: ROCK, label: 'Rock' },
    ]);
  });
});

describe('city matching and defaults', () => {
  it('matches free-text city names ignoring case and accents', () => {
    expect(matchCityByName(options.cities, '  bogota ')?.id).toBe(BOGOTA);
    expect(matchCityByName(options.cities, 'QUITO')?.id).toBe(QUITO);
    expect(matchCityByName(options.cities, 'Lima')).toBeNull();
    expect(matchCityByName(options.cities, '')).toBeNull();
  });

  it('starts only with the city the viewer chose before, never an imposed one', () => {
    expect(defaultCityFor(options.cities, BOGOTA)?.id).toBe(BOGOTA);
    expect(defaultCityFor(options.cities, 'not-a-city')).toBeNull();
    expect(defaultCityFor(options.cities, null)).toBeNull();
  });
});
