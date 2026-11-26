// TAX-FILTER-001: the one filter set shared by every surface. It lives in a
// tiny external store, persisted with AsyncStorage; when storage is
// unavailable the in-memory state keeps working for the session.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import type { TaxonomySelection } from '../../api/taxonomy';
import { emptyTaxonomySelection, normalizeTaxonomySelection, taxonomySelectionsEqual } from './taxonomyFilterModel';

export const TAXONOMY_FILTER_STORAGE_KEY = 'tdf-mobile/taxonomy-filters/v1';

export interface SharedTaxonomyState {
  selection: TaxonomySelection;
  /** A default (or the viewer's own choice) has been applied once; defaults never run again. */
  initialized: boolean;
  /** Storage has been read (or failed); defaults wait for this. */
  hydrated: boolean;
}

const initialState = (): SharedTaxonomyState => ({ selection: emptyTaxonomySelection(), initialized: false, hydrated: false });

let state: SharedTaxonomyState = initialState();
let hydration: Promise<void> | null = null;
/** Bumped by every write so a slow storage read never overwrites a newer choice. */
let revision = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const persist = () => {
  const snapshot = JSON.stringify({ selection: state.selection, initialized: state.initialized });
  void AsyncStorage.setItem(TAXONOMY_FILTER_STORAGE_KEY, snapshot).catch(() => {
    // Storage may be unavailable; the in-memory state still works.
  });
};

export const hydrateSharedTaxonomyState = (): Promise<void> => {
  if (hydration) return hydration;
  const startedAt = revision;
  hydration = AsyncStorage.getItem(TAXONOMY_FILTER_STORAGE_KEY)
    .then((raw) => {
      if (revision !== startedAt) return;
      if (!raw) return;
      const parsed = JSON.parse(raw) as { selection?: unknown; initialized?: unknown };
      state = { ...state, selection: normalizeTaxonomySelection(parsed.selection), initialized: parsed.initialized === true };
    })
    .catch(() => undefined)
    .then(() => {
      state = { ...state, hydrated: true };
      emit();
    });
  return hydration;
};

export const getSharedTaxonomyState = () => state;
export const getSharedTaxonomySelection = () => state.selection;

export const setSharedTaxonomySelection = (selection: TaxonomySelection) => {
  const normalized = normalizeTaxonomySelection(selection);
  if (state.initialized && taxonomySelectionsEqual(normalized, state.selection)) return;
  revision += 1;
  state = { ...state, selection: normalized, initialized: true };
  persist();
  emit();
};

export const markSharedTaxonomyInitialized = () => {
  if (state.initialized) return;
  revision += 1;
  state = { ...state, initialized: true };
  persist();
  emit();
};

/** Test seam: forget the in-memory state so the next hydration reads storage again. */
export const resetSharedTaxonomyStateForTests = () => {
  state = initialState();
  hydration = null;
  revision = 0;
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useSharedTaxonomyState = (): SharedTaxonomyState => {
  const snapshot = useSyncExternalStore(subscribe, getSharedTaxonomyState, getSharedTaxonomyState);
  useEffect(() => {
    void hydrateSharedTaxonomyState();
  }, []);
  return snapshot;
};
