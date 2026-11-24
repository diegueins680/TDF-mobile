// TAX-FILTER-001: one shared filter set, overridable per surface.
//
// * A surface shows the shared set unless it carries its own selection.
// * A deep link with `f.*` params opens with those filters; when they differ
//   from the viewer's shared set (or carry `f.scope=local`) they are shown as
//   this surface's own filters.
// * Changing filters updates the shared set (every surface follows) unless
//   the viewer chose "only here", which keeps them on this surface.
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Taxonomy, type TaxonomyFilterOptions, type TaxonomySelection } from '../../api/taxonomy';
import {
  emptyTaxonomySelection,
  hasTaxonomyRouteState,
  isLocalTaxonomyScope,
  normalizeTaxonomySelection,
  readTaxonomySelectionFromParams,
  taxonomySelectionKey,
  taxonomySelectionsEqual,
  type TaxonomyRouteParams,
} from './taxonomyFilterModel';
import { setSharedTaxonomySelection, useSharedTaxonomyState } from './taxonomyFilterStore';

export const TAXONOMY_OPTIONS_QUERY_KEY = ['taxonomy', 'filter-options'] as const;

export const useTaxonomyFilterOptions = () =>
  useQuery<TaxonomyFilterOptions>({
    queryKey: TAXONOMY_OPTIONS_QUERY_KEY,
    queryFn: () => Taxonomy.filterOptions(),
    staleTime: 10 * 60_000,
  });

export interface SurfaceTaxonomyFilters {
  /** The selection this surface queries with. */
  selection: TaxonomySelection;
  /** True when this surface shows its own filters rather than the shared set. */
  isOverride: boolean;
  /** False until the shared set has been read from storage. */
  ready: boolean;
  /** Replace the selection. `onlyHere` keeps it on this surface. */
  setSelection: (next: TaxonomySelection, onlyHere?: boolean) => void;
  /** Drop this surface's own filters and show the shared set again. */
  resetToShared: () => void;
  /** Make this surface's filters the shared set. */
  applyEverywhere: () => void;
  clearAll: () => void;
}

interface Override {
  selection: TaxonomySelection;
  /** Deliberately local: stays an override even when it equals the shared set. */
  local: boolean;
}

const overrideFromParams = (params: TaxonomyRouteParams | undefined): Override | null =>
  params && hasTaxonomyRouteState(params)
    ? { selection: readTaxonomySelectionFromParams(params), local: isLocalTaxonomyScope(params) }
    : null;

export const useSurfaceTaxonomyFilters = ({
  routeParams,
  onChange,
}: {
  /** The screen's route params; `f.*` keys seed this surface's override. */
  routeParams?: TaxonomyRouteParams;
  /** Called after a change so a screen can reset its pagination. */
  onChange?: () => void;
} = {}): SurfaceTaxonomyFilters => {
  const shared = useSharedTaxonomyState();
  const routeOverride = useMemo(() => overrideFromParams(routeParams), [routeParams]);
  const routeKey = routeOverride ? `${taxonomySelectionKey(routeOverride.selection)}#${routeOverride.local}` : null;
  const [override, setOverride] = useState<Override | null>(routeOverride);
  const lastRouteKey = useRef(routeKey);

  // A new deep link into an already mounted tab replaces the surface's filters.
  useEffect(() => {
    if (routeKey === lastRouteKey.current) return;
    lastRouteKey.current = routeKey;
    if (routeOverride) setOverride(routeOverride);
  }, [routeKey, routeOverride]);

  // A link that only repeats the viewer's shared filters is not an override;
  // dropping it lets this surface follow later changes to the shared set.
  useEffect(() => {
    if (shared.hydrated && override && !override.local && taxonomySelectionsEqual(override.selection, shared.selection)) {
      setOverride(null);
    }
  }, [override, shared.hydrated, shared.selection]);

  const selection = override?.selection ?? shared.selection;
  const isOverride = override !== null && (override.local || !taxonomySelectionsEqual(override.selection, shared.selection));

  const setSelection = useCallback((next: TaxonomySelection, onlyHere = false) => {
    const normalized = normalizeTaxonomySelection(next);
    if (onlyHere || isOverride) {
      setOverride({ selection: normalized, local: true });
    } else {
      setSharedTaxonomySelection(normalized);
      setOverride(null);
    }
    onChange?.();
  }, [isOverride, onChange]);

  const resetToShared = useCallback(() => {
    setOverride(null);
    onChange?.();
  }, [onChange]);

  const applyEverywhere = useCallback(() => {
    setSharedTaxonomySelection(selection);
    setOverride(null);
  }, [selection]);

  const clearAll = useCallback(() => setSelection(emptyTaxonomySelection()), [setSelection]);

  return { selection, isOverride, ready: shared.hydrated, setSelection, resetToShared, applyEverywhere, clearAll };
};
