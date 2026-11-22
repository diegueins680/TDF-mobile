import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { emptyTaxonomySelection } from '../src/features/taxonomyFilters/taxonomyFilterModel';
import {
  getSharedTaxonomySelection,
  hydrateSharedTaxonomyState,
  resetSharedTaxonomyStateForTests,
  setSharedTaxonomySelection,
  TAXONOMY_FILTER_STORAGE_KEY,
} from '../src/features/taxonomyFilters/taxonomyFilterStore';
import { useSurfaceTaxonomyFilters } from '../src/features/taxonomyFilters/useTaxonomyFilters';

jest.mock('../src/api/taxonomy', () => ({ Taxonomy: { filterOptions: jest.fn() } }));

const QUITO = '44444444-4444-4444-8444-444444444444';
const BOGOTA = '55555555-5555-4555-8555-555555555555';
const ROCK = '66666666-6666-4666-8666-666666666666';

describe('shared taxonomy filter store', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetSharedTaxonomyStateForTests();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('restores the persisted shared selection', async () => {
    await AsyncStorage.setItem(TAXONOMY_FILTER_STORAGE_KEY, JSON.stringify({
      selection: { cityIds: [QUITO], genreIds: ['bogus'] }, initialized: true,
    }));
    await hydrateSharedTaxonomyState();
    expect(getSharedTaxonomySelection()).toEqual({ ...emptyTaxonomySelection(), cityIds: [QUITO] });
  });

  it('keeps working in memory when storage fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('unavailable'));
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('unavailable'));
    await hydrateSharedTaxonomyState();
    setSharedTaxonomySelection({ ...emptyTaxonomySelection(), genreIds: [ROCK] });
    expect(getSharedTaxonomySelection().genreIds).toEqual([ROCK]);
  });

  it('shares a change with every surface unless it is kept on one surface', async () => {
    const directory = renderHook(() => useSurfaceTaxonomyFilters());
    const events = renderHook(() => useSurfaceTaxonomyFilters());
    await waitFor(() => expect(directory.result.current.ready).toBe(true));

    act(() => directory.result.current.setSelection({ ...emptyTaxonomySelection(), cityIds: [QUITO] }));
    expect(events.result.current.selection.cityIds).toEqual([QUITO]);
    expect(events.result.current.isOverride).toBe(false);
    await waitFor(async () => expect(JSON.parse(await AsyncStorage.getItem(TAXONOMY_FILTER_STORAGE_KEY) ?? '{}').selection.cityIds).toEqual([QUITO]));

    act(() => events.result.current.setSelection({ ...emptyTaxonomySelection(), cityIds: [BOGOTA] }, true));
    expect(events.result.current.isOverride).toBe(true);
    expect(events.result.current.selection.cityIds).toEqual([BOGOTA]);
    expect(directory.result.current.selection.cityIds).toEqual([QUITO]);

    act(() => events.result.current.applyEverywhere());
    expect(events.result.current.isOverride).toBe(false);
    expect(directory.result.current.selection.cityIds).toEqual([BOGOTA]);
  });

  it('opens a deep link with different filters as this surface override', async () => {
    setSharedTaxonomySelection({ ...emptyTaxonomySelection(), cityIds: [QUITO] });
    const { result } = renderHook(() => useSurfaceTaxonomyFilters({ routeParams: { 'f.genre': [ROCK] } }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.selection).toEqual({ ...emptyTaxonomySelection(), genreIds: [ROCK] });
    expect(result.current.isOverride).toBe(true);

    act(() => result.current.resetToShared());
    expect(result.current.selection.cityIds).toEqual([QUITO]);
    expect(result.current.isOverride).toBe(false);
  });

  it('treats an explicit local scope as an override even when it matches', async () => {
    setSharedTaxonomySelection({ ...emptyTaxonomySelection(), cityIds: [QUITO] });
    const { result } = renderHook(() => useSurfaceTaxonomyFilters({ routeParams: { 'f.city': QUITO, 'f.scope': 'local' } }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.isOverride).toBe(true);

    act(() => result.current.clearAll());
    expect(result.current.selection).toEqual(emptyTaxonomySelection());
    expect(getSharedTaxonomySelection().cityIds).toEqual([QUITO]);
  });
});
