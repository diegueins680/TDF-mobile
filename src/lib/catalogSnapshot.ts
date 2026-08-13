import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  CatalogBatch,
  CatalogDefault,
  CatalogItem,
  CatalogPage,
  WorkflowState,
  WorkflowStates,
} from '../api/catalogs';
import { fetchCatalogBatch, fetchPublicWorkflowStates } from '../api/catalogs';

export const CATALOG_SNAPSHOT_SCHEMA_VERSION = 9;
export const REQUIRED_BOOT_CATALOGS = ['locales', 'currencies', 'appearance-modes'] as const;
export const SYNCED_CATALOGS = [...REQUIRED_BOOT_CATALOGS, 'genres', 'countries', 'event-types', 'reaction-types', 'content-reaction-types', 'creator-badge-types'] as const;
export const SOCIAL_EVENT_WORKFLOW_CODE = 'social-event-lifecycle';
const LEGACY_V2_CATALOGS = ['locales', 'currencies', 'genres'] as const;
const LEGACY_V3_CATALOGS = [...LEGACY_V2_CATALOGS, 'countries'] as const;
const LEGACY_V4_CATALOGS = [...LEGACY_V3_CATALOGS, 'appearance-modes'] as const;
const LEGACY_V5_CATALOGS = [...LEGACY_V4_CATALOGS, 'event-types'] as const;
const LEGACY_V6_CATALOGS = LEGACY_V5_CATALOGS;
const LEGACY_V7_CATALOGS = [...LEGACY_V6_CATALOGS, 'reaction-types'] as const;
const LEGACY_V8_CATALOGS = [...LEGACY_V7_CATALOGS, 'content-reaction-types'] as const;
const STORAGE_KEY = 'tdf-catalog-snapshot-v2';

export interface CatalogSnapshot {
  schemaVersion: typeof CATALOG_SNAPSHOT_SCHEMA_VERSION;
  revision: number;
  locale: string;
  etag: string | null;
  workflowEtag: string | null;
  syncedAt: string;
  source: 'network' | 'emergency';
  catalogs: Record<string, CatalogPage>;
  workflows: Record<string, WorkflowStates>;
}

const emergencyItem = (
  catalogCode: string,
  code: string,
  nameEs: string,
  nameEn: string,
  sortOrder: number,
): CatalogItem => ({
  id: `emergency:${catalogCode}:${code}`,
  catalogId: `emergency:${catalogCode}`,
  catalogCode,
  kind: `emergency-${catalogCode}`,
  code,
  name: nameEs,
  nameEs,
  nameEn,
  searchAliases: [],
  sortOrder,
  active: true,
  workflowState: 'emergency',
  usageCount: 0,
  version: 1,
});

const emergencyPage = (
  code: string,
  items: CatalogItem[],
  defaultScope?: Pick<CatalogDefault, 'entityId' | 'scopeKind' | 'scopeId'>,
): CatalogPage => ({
  catalog: {
    id: `emergency:${code}`,
    code,
    classification: 'emergency-recovery-data',
    entityKind: `emergency-${code}`,
    name: code,
    publicRead: true,
    sensitive: false,
    orderingMode: 'manual',
    cacheRevision: 0,
    active: true,
    version: 1,
  },
  items,
  defaults: defaultScope
    ? [{
        ...defaultScope,
        version: 1,
      }]
    : [],
  page: 1,
  pageSize: items.length,
  total: items.length,
  revision: 0,
  locale: 'es',
});

export const emergencyCatalogSnapshot = (): CatalogSnapshot => {
  const emergencyLocales = [
    emergencyItem('locales', 'es', 'Español', 'Spanish', 0),
    emergencyItem('locales', 'en', 'Inglés', 'English', 1),
  ];
  const emergencyCurrencies = [
    emergencyItem('currencies', 'USD', 'Dólar estadounidense', 'US Dollar', 0),
  ];
  const emergencyAppearanceModes = [
    emergencyItem('appearance-modes', 'system', 'Usar configuración del sistema', 'Use system setting', 0),
    emergencyItem('appearance-modes', 'light', 'Tema claro', 'Light theme', 1),
    emergencyItem('appearance-modes', 'dark', 'Tema oscuro', 'Dark theme', 2),
  ];
  return {
    schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
    revision: 0,
    locale: 'es',
    etag: null,
    workflowEtag: null,
    syncedAt: new Date(0).toISOString(),
    source: 'emergency',
    catalogs: {
      locales: emergencyPage('locales', emergencyLocales, {
        entityId: emergencyLocales[0]!.id,
        scopeKind: 'deployment',
        scopeId: 'emergency',
      }),
      currencies: emergencyPage('currencies', emergencyCurrencies, {
        entityId: emergencyCurrencies[0]!.id,
        scopeKind: 'deployment',
        scopeId: 'emergency',
      }),
      'appearance-modes': emergencyPage(
        'appearance-modes',
        emergencyAppearanceModes,
        {
          entityId: emergencyAppearanceModes[0]!.id,
          scopeKind: 'appearance-mode',
          scopeId: 'global',
        },
      ),
    },
    workflows: {},
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isValidDefault = (value: unknown): value is CatalogDefault =>
  isRecord(value)
    && typeof value.entityId === 'string'
    && typeof value.scopeKind === 'string'
    && typeof value.scopeId === 'string'
    && typeof value.version === 'number';

const isValidPage = (value: unknown, expectedCode: string, requireDefaults = true): value is CatalogPage => {
  if (!isRecord(value) || !isRecord(value.catalog) || !Array.isArray(value.items)) return false;
  if (requireDefaults && !Array.isArray(value.defaults)) return false;
  if (Array.isArray(value.defaults) && !value.defaults.every(isValidDefault)) return false;
  if (value.catalog.code !== expectedCode || value.catalog.active !== true) return false;
  return value.items.every((item) => (
    isRecord(item)
    && typeof item.id === 'string'
    && typeof item.code === 'string'
    && typeof item.name === 'string'
    && item.catalogCode === expectedCode
    && typeof item.active === 'boolean'
  ));
};

const isRecognizedAppearanceCode = (code: string): boolean =>
  code === 'system' || code === 'light' || code === 'dark';
const CATALOG_ENTITY_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidAppearancePage = (page: CatalogPage | undefined, allowMarkedEmergency = false): boolean => {
  if (
    !page
    || page.items.length === 0
    || !Array.isArray(page.defaults)
    || !page.items.every((item) => (
      isRecognizedAppearanceCode(item.code)
      && item.active
      && (item.workflowState === 'published' || (allowMarkedEmergency && item.workflowState === 'emergency'))
    ))
    || new Set(page.items.map((item) => item.id)).size !== page.items.length
    || new Set(page.items.map((item) => item.code)).size !== page.items.length
  ) return false;
  const defaults = page.defaults.filter(
    (entry) => entry.scopeKind === 'appearance-mode' && entry.scopeId === 'global' && !entry.localeId,
  );
  return defaults.length === 1 && page.items.some((item) => item.id === defaults[0]?.entityId);
};

const isValidWorkflowState = (
  value: unknown,
  workflowCode: string,
): value is WorkflowState => isRecord(value)
  && CATALOG_ENTITY_UUID_PATTERN.test(String(value.id))
  && CATALOG_ENTITY_UUID_PATTERN.test(String(value.workflowId))
  && value.workflowCode === workflowCode
  && typeof value.code === 'string'
  && value.code.trim().length > 0
  && typeof value.name === 'string'
  && value.name.trim().length > 0
  && typeof value.nameEs === 'string'
  && value.nameEs.trim().length > 0
  && typeof value.nameEn === 'string'
  && value.nameEn.trim().length > 0
  && typeof value.sortOrder === 'number'
  && typeof value.terminal === 'boolean'
  && value.active === true
  && Array.isArray(value.initialContexts)
  && value.initialContexts.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
  && Array.isArray(value.capabilities)
  && value.capabilities.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
  && Array.isArray(value.transitions)
  && value.transitions.every((entry) => isRecord(entry)
    && typeof entry.toStateId === 'string'
    && CATALOG_ENTITY_UUID_PATTERN.test(entry.toStateId)
    && typeof entry.directExecutionAllowed === 'boolean'
    && typeof entry.requiresReview === 'boolean'
    && typeof entry.requiresDistinctApprover === 'boolean'
    && (entry.effectiveFrom === undefined || typeof entry.effectiveFrom === 'string')
    && (entry.effectiveUntil === undefined || typeof entry.effectiveUntil === 'string')
    && typeof entry.version === 'number'
    && entry.version >= 1)
  && typeof value.version === 'number'
  && value.version >= 1;

const isValidWorkflow = (value: unknown, workflowCode: string): value is WorkflowStates => {
  if (
    !isRecord(value)
    || value.workflowCode !== workflowCode
    || typeof value.locale !== 'string'
    || typeof value.revision !== 'number'
    || value.revision < 1
    || !Array.isArray(value.states)
    || value.states.length === 0
    || !value.states.every((state) => isValidWorkflowState(state, workflowCode))
  ) return false;
  const states = value.states as WorkflowState[];
  const stateIds = new Set(states.map((state) => state.id));
  return stateIds.size === states.length
    && new Set(states.map((state) => state.workflowId)).size === 1
    && new Set(states.map((state) => state.code)).size === states.length
    && states.flatMap((state) => state.initialContexts).filter((context) => context === 'initial').length === 1
    && states.every((state) => (
      new Set(state.transitions.map((transition) => transition.toStateId)).size === state.transitions.length
      && state.transitions.every((transition) => {
        if (!stateIds.has(transition.toStateId)) return false;
        const effectiveFrom = transition.effectiveFrom ? Date.parse(transition.effectiveFrom) : null;
        const effectiveUntil = transition.effectiveUntil ? Date.parse(transition.effectiveUntil) : null;
        return (effectiveFrom === null || Number.isFinite(effectiveFrom))
          && (effectiveUntil === null || Number.isFinite(effectiveUntil))
          && (effectiveFrom === null || effectiveUntil === null || effectiveUntil > effectiveFrom);
      })
    ));
};

const isValidSocialEventTypePage = (page: CatalogPage | undefined): boolean => {
  if (
    !page
    || page.items.length === 0
    || !page.items.every((item) => (
      item.active
      && item.workflowState === 'published'
      && !item.deprecatedAt
      && CATALOG_ENTITY_UUID_PATTERN.test(item.id)
    ))
    || new Set(page.items.map((item) => item.id)).size !== page.items.length
    || new Set(page.items.map((item) => item.code)).size !== page.items.length
  ) return false;
  const defaults = page.defaults.filter(
    (entry) => entry.scopeKind === 'social-event' && entry.scopeId === 'global' && !entry.localeId,
  );
  return defaults.length === 1 && page.items.some((item) => item.id === defaults[0]?.entityId);
};

const isValidReactionTypePage = (page: CatalogPage | undefined): boolean => Boolean(
  page
    && page.items.length > 0
    && page.items.every((item) => (
      item.active
        && item.workflowState === 'published'
        && !item.deprecatedAt
        && CATALOG_ENTITY_UUID_PATTERN.test(item.id)
        && typeof item.displaySymbol === 'string'
        && item.displaySymbol.trim().length > 0
        && item.displaySymbol.length <= 16
    ))
    && new Set(page.items.map((item) => item.id)).size === page.items.length
    && new Set(page.items.map((item) => item.code)).size === page.items.length,
);

const isValidPublishedFlatPage = (page: CatalogPage | undefined): boolean => Boolean(
  page
    && page.items.length > 0
    && page.items.every((item) => (
      item.active
        && item.workflowState === 'published'
        && !item.deprecatedAt
        && CATALOG_ENTITY_UUID_PATTERN.test(item.id)
    ))
    && new Set(page.items.map((item) => item.id)).size === page.items.length
    && new Set(page.items.map((item) => item.code)).size === page.items.length,
);

export const parseCatalogSnapshot = (raw: string): CatalogSnapshot | null => {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)) return null;
    const schemaVersion = value.schemaVersion as number;
    if (![2, 3, 4, 5, 6, 7, 8, CATALOG_SNAPSHOT_SCHEMA_VERSION].includes(schemaVersion) || value.source !== 'network') return null;
    if (typeof value.revision !== 'number' || value.revision < 0) return null;
    if (typeof value.locale !== 'string' || typeof value.syncedAt !== 'string') return null;
    if (!(value.etag === null || typeof value.etag === 'string') || !isRecord(value.catalogs)) return null;
    const requiredCatalogs = schemaVersion === 2
      ? LEGACY_V2_CATALOGS
      : schemaVersion === 3
        ? LEGACY_V3_CATALOGS
        : schemaVersion === 4
          ? LEGACY_V4_CATALOGS
          : schemaVersion === 5
            ? LEGACY_V5_CATALOGS
            : schemaVersion === 6
              ? LEGACY_V6_CATALOGS
              : schemaVersion === 7
                ? LEGACY_V7_CATALOGS
                : schemaVersion === 8
                  ? LEGACY_V8_CATALOGS
                : SYNCED_CATALOGS;
    if (!requiredCatalogs.every((code) => isValidPage(value.catalogs[code], code, schemaVersion === CATALOG_SNAPSHOT_SCHEMA_VERSION))) return null;
    const emergencyAppearance = emergencyCatalogSnapshot().catalogs['appearance-modes']!;
    const catalogs = Object.fromEntries(
      Object.entries(value.catalogs).map(([code, page]) => [
        code,
        isRecord(page) && !Array.isArray(page.defaults) ? { ...page, defaults: [] } : page,
      ]),
    ) as Record<string, CatalogPage>;
    const injectedEmergencyAppearance = !catalogs['appearance-modes'];
    if (injectedEmergencyAppearance) catalogs['appearance-modes'] = emergencyAppearance;
    if (!isValidAppearancePage(catalogs['appearance-modes'], injectedEmergencyAppearance)) return null;
    if (schemaVersion >= 5 && !isValidSocialEventTypePage(catalogs['event-types'])) return null;
    if (schemaVersion >= 7 && !isValidReactionTypePage(catalogs['reaction-types'])) return null;
    if (schemaVersion >= 8 && !isValidReactionTypePage(catalogs['content-reaction-types'])) return null;
    if (schemaVersion === CATALOG_SNAPSHOT_SCHEMA_VERSION && !isValidPublishedFlatPage(catalogs['creator-badge-types'])) return null;
    const workflows = schemaVersion === CATALOG_SNAPSHOT_SCHEMA_VERSION && isRecord(value.workflows)
      ? value.workflows
      : {};
    if (
      schemaVersion === CATALOG_SNAPSHOT_SCHEMA_VERSION
      && (
        !(value.workflowEtag === null || typeof value.workflowEtag === 'string')
        || !isValidWorkflow(workflows[SOCIAL_EVENT_WORKFLOW_CODE], SOCIAL_EVENT_WORKFLOW_CODE)
      )
    ) return null;
    return {
      ...value,
      catalogs,
      workflows,
      schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
      etag: schemaVersion === CATALOG_SNAPSHOT_SCHEMA_VERSION ? value.etag : null,
      workflowEtag: schemaVersion === CATALOG_SNAPSHOT_SCHEMA_VERSION ? value.workflowEtag : null,
    } as unknown as CatalogSnapshot;
  } catch {
    return null;
  }
};

export const loadLastKnownGoodCatalogSnapshot = async (): Promise<CatalogSnapshot | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? parseCatalogSnapshot(raw) : null;
  } catch {
    return null;
  }
};

const snapshotFromSources = (
  batch: CatalogBatch,
  workflow: WorkflowStates,
  etag: string | null,
  workflowEtag: string | null,
  syncedAt: string,
): CatalogSnapshot | null => {
  const catalogs = Object.fromEntries(batch.catalogs.map((page) => [page.catalog.code, page]));
  if (!SYNCED_CATALOGS.every((code) => isValidPage(catalogs[code], code))) return null;
  if (!isValidAppearancePage(catalogs['appearance-modes'])) return null;
  if (!isValidSocialEventTypePage(catalogs['event-types'])) return null;
  if (!isValidReactionTypePage(catalogs['reaction-types'])) return null;
  if (!isValidReactionTypePage(catalogs['content-reaction-types'])) return null;
  if (!isValidPublishedFlatPage(catalogs['creator-badge-types'])) return null;
  if (!isValidWorkflow(workflow, SOCIAL_EVENT_WORKFLOW_CODE)) return null;
  return {
    schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
    revision: batch.revision,
    locale: batch.locale,
    etag,
    workflowEtag,
    syncedAt,
    source: 'network',
    catalogs,
    workflows: { [SOCIAL_EVENT_WORKFLOW_CODE]: workflow },
  };
};

export const refreshCatalogSnapshot = async (
  locale: string,
  current?: CatalogSnapshot | null,
): Promise<CatalogSnapshot> => {
  const cached = current?.source === 'network' ? current : await loadLastKnownGoodCatalogSnapshot();
  try {
    const normalizedLocale = locale.trim() || 'es';
    const matchingCache = cached?.locale === normalizedLocale ? cached : null;
    const [catalogResponse, workflowResponse] = await Promise.all([
      fetchCatalogBatch(SYNCED_CATALOGS, normalizedLocale, matchingCache?.etag),
      fetchPublicWorkflowStates(
        SOCIAL_EVENT_WORKFLOW_CODE,
        normalizedLocale,
        matchingCache?.workflowEtag,
      ),
    ]);
    if (catalogResponse.notModified && workflowResponse.notModified && matchingCache) return matchingCache;
    const batch = catalogResponse.batch ?? (matchingCache
      ? {
          catalogs: Object.values(matchingCache.catalogs),
          revision: matchingCache.revision,
          locale: matchingCache.locale,
        }
      : null);
    const workflow = workflowResponse.workflow
      ?? matchingCache?.workflows[SOCIAL_EVENT_WORKFLOW_CODE]
      ?? null;
    if (!batch || !workflow) throw new Error('La API no devolvió una instantánea completa de catálogos.');
    const next = snapshotFromSources(
      batch,
      workflow,
      catalogResponse.etag,
      workflowResponse.etag,
      new Date().toISOString(),
    );
    if (!next) throw new Error('La instantánea de catálogos no contiene los datos mínimos requeridos.');
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return cached ?? emergencyCatalogSnapshot();
  }
};

export const catalogItems = (snapshot: CatalogSnapshot, code: string): CatalogItem[] =>
  (snapshot.catalogs[code]?.items ?? [])
    .filter((item) => item.active && item.workflowState !== 'rejected')
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));

export const catalogCodes = (snapshot: CatalogSnapshot, code: string): string[] =>
  catalogItems(snapshot, code).map((item) => item.code);

export const catalogDefaults = (snapshot: CatalogSnapshot, code: string): CatalogDefault[] =>
  snapshot.catalogs[code]?.defaults ?? [];

export const workflowStates = (snapshot: CatalogSnapshot, workflowCode: string): WorkflowState[] =>
  (snapshot.workflows[workflowCode]?.states ?? [])
    .filter((state) => state.active)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
