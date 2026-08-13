import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCatalogBatch, fetchPublicWorkflowStates } from '../api/catalogs';
import {
  CATALOG_SNAPSHOT_SCHEMA_VERSION,
  SOCIAL_EVENT_WORKFLOW_CODE,
  SYNCED_CATALOGS,
  parseCatalogSnapshot,
  refreshCatalogSnapshot,
  type CatalogSnapshot,
} from './catalogSnapshot';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('../api/catalogs', () => ({
  fetchCatalogBatch: jest.fn(),
  fetchPublicWorkflowStates: jest.fn(),
}));

const fetchCatalogBatchMock = jest.mocked(fetchCatalogBatch);
const fetchPublicWorkflowStatesMock = jest.mocked(fetchPublicWorkflowStates);
const storageMock = jest.mocked(AsyncStorage);

const uuid = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

const item = (catalogCode: string, code: string, identifier: string) => ({
  id: identifier,
  catalogId: uuid(100),
  catalogCode,
  kind: catalogCode,
  code,
  name: code,
  nameEs: code,
  nameEn: code,
  searchAliases: [],
  sortOrder: 1,
  active: true,
  workflowState: 'published',
  usageCount: 0,
  version: 1,
});

const page = (code: string) => {
  const items = code === 'appearance-modes'
    ? [item(code, 'system', uuid(201))]
    : code === 'event-types'
      ? [item(code, 'concert', uuid(202))]
      : code === 'reaction-types' || code === 'content-reaction-types'
        ? [{ ...item(code, 'fire', uuid(204)), displaySymbol: '🔥' }]
        : [item(code, `${code}-value`, uuid(203 + SYNCED_CATALOGS.indexOf(code as never)))];
  const defaults = code === 'appearance-modes'
    ? [{ entityId: items[0]!.id, scopeKind: 'appearance-mode', scopeId: 'global', version: 1 }]
    : code === 'event-types'
      ? [{ entityId: items[0]!.id, scopeKind: 'social-event', scopeId: 'global', version: 1 }]
      : [];
  return {
    catalog: {
      id: uuid(100),
      code,
      classification: 'dynamic-business-catalog',
      entityKind: code,
      name: code,
      publicRead: true,
      sensitive: false,
      orderingMode: 'manual',
      cacheRevision: 1,
      active: true,
      version: 1,
    },
    items,
    defaults,
    page: 1,
    pageSize: items.length,
    total: items.length,
    revision: 1,
    locale: 'es',
  };
};

const workflow = () => ({
  workflowCode: SOCIAL_EVENT_WORKFLOW_CODE,
  locale: 'es',
  revision: 9,
  states: [
    {
      id: uuid(301),
      workflowId: uuid(300),
      workflowCode: SOCIAL_EVENT_WORKFLOW_CODE,
      code: 'first',
      name: 'Primero',
      nameEs: 'Primero',
      nameEn: 'First',
      sortOrder: 10,
      terminal: false,
      active: true,
      initialContexts: ['initial'],
      capabilities: [],
      transitions: [{
        toStateId: uuid(302),
        directExecutionAllowed: true,
        requiresReview: false,
        requiresDistinctApprover: false,
        version: 1,
      }],
      version: 1,
    },
    {
      id: uuid(302),
      workflowId: uuid(300),
      workflowCode: SOCIAL_EVENT_WORKFLOW_CODE,
      code: 'second',
      name: 'Segundo',
      nameEs: 'Segundo',
      nameEn: 'Second',
      sortOrder: 20,
      terminal: true,
      active: true,
      initialContexts: [],
      capabilities: ['public-listable'],
      transitions: [],
      version: 1,
    },
  ],
});

const validSnapshot = (): CatalogSnapshot => ({
  schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
  revision: 7,
  locale: 'es',
  etag: '"catalog-7"',
  workflowEtag: '"workflow-social-event-lifecycle-9"',
  syncedAt: '2026-08-11T12:00:00.000Z',
  source: 'network',
  catalogs: Object.fromEntries(SYNCED_CATALOGS.map((code) => [code, page(code)])),
  workflows: { [SOCIAL_EVENT_WORKFLOW_CODE]: workflow() },
});

describe('versioned catalog snapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a canonical workflow snapshot without comparing against a frontend status list', () => {
    const snapshot = validSnapshot();
    expect(parseCatalogSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('rejects a workflow transition that points outside the persisted snapshot', () => {
    const snapshot = validSnapshot();
    snapshot.workflows[SOCIAL_EVENT_WORKFLOW_CODE]!.states[0]!.transitions[0]!.toStateId = uuid(999);
    expect(parseCatalogSnapshot(JSON.stringify(snapshot))).toBeNull();
  });

  it('upgrades a last-known-good v5 snapshot without inventing emergency workflow data', () => {
    const snapshot = validSnapshot() as unknown as Record<string, unknown>;
    snapshot.schemaVersion = 5;
    delete snapshot.workflowEtag;
    delete snapshot.workflows;
    const parsed = parseCatalogSnapshot(JSON.stringify(snapshot));
    expect(parsed).toMatchObject({
      schemaVersion: CATALOG_SNAPSHOT_SCHEMA_VERSION,
      workflowEtag: null,
      workflows: {},
      source: 'network',
    });
  });

  it('combines a cached catalog 304 with a newly published workflow revision atomically', async () => {
    const cached = validSnapshot();
    const changedWorkflow = workflow();
    changedWorkflow.revision = 10;
    fetchCatalogBatchMock.mockResolvedValue({ batch: null, etag: cached.etag, notModified: true });
    fetchPublicWorkflowStatesMock.mockResolvedValue({
      workflow: changedWorkflow,
      etag: '"workflow-social-event-lifecycle-10"',
      notModified: false,
    });

    const refreshed = await refreshCatalogSnapshot('es', cached);

    expect(refreshed.workflows[SOCIAL_EVENT_WORKFLOW_CODE]?.revision).toBe(10);
    expect(refreshed.workflowEtag).toBe('"workflow-social-event-lifecycle-10"');
    expect(storageMock.setItem).toHaveBeenCalledTimes(1);
  });

  it('keeps the last-known-good snapshot when either synchronized source fails', async () => {
    const cached = validSnapshot();
    fetchCatalogBatchMock.mockResolvedValue({ batch: null, etag: cached.etag, notModified: true });
    fetchPublicWorkflowStatesMock.mockRejectedValue(new Error('offline'));

    await expect(refreshCatalogSnapshot('es', cached)).resolves.toBe(cached);
    expect(storageMock.setItem).not.toHaveBeenCalled();
  });
});
