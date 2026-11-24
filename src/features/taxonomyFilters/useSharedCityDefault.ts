// TAX-FILTER-001: the first time the shared filter set is used it starts with
// the city the viewer chose in the old directory picker, if any; afterwards the
// viewer's own choice is never overridden.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import type { TaxonomyFilterOptions } from '../../api/taxonomy';
import { defaultCityFor, emptyTaxonomySelection } from './taxonomyFilterModel';
import {
  getSharedTaxonomyState,
  markSharedTaxonomyInitialized,
  setSharedTaxonomySelection,
  useSharedTaxonomyState,
} from './taxonomyFilterStore';

export const LEGACY_DIRECTORY_CITY_STORAGE_KEY = 'tdf-mobile/directory-city-id';

export const useSharedCityDefault = (options: TaxonomyFilterOptions | undefined) => {
  const shared = useSharedTaxonomyState();
  const attempted = useRef(false);
  useEffect(() => {
    if (attempted.current || !options || !shared.hydrated || shared.initialized) return;
    attempted.current = true;
    void AsyncStorage.getItem(LEGACY_DIRECTORY_CITY_STORAGE_KEY)
      .catch(() => null)
      .then((stored) => {
        if (getSharedTaxonomyState().initialized) return;
        const city = defaultCityFor(options.cities, stored);
        if (city) setSharedTaxonomySelection({ ...emptyTaxonomySelection(), cityIds: [city.id] });
        else markSharedTaxonomyInitialized();
      });
  }, [options, shared.hydrated, shared.initialized]);
};
