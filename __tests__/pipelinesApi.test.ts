const mockGet = jest.fn();
const mockPatch = jest.fn();

const mockAsyncStorage = {
  getItem: jest.fn<Promise<string | null>, [string]>(),
  setItem: jest.fn<Promise<void>, [string, string]>(),
  removeItem: jest.fn<Promise<void>, [string]>(),
};

jest.mock('../src/api/client', () => ({
  get: (...args: unknown[]) => mockGet(...args),
  patch: (...args: unknown[]) => mockPatch(...args),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

const workflowId = '00000000-0000-4000-8000-000000000106';
const serviceId = '10000000-0000-4000-8000-000000000001';
const stateId = '00000000-0000-4000-8000-000000000251';
const definitions = [{
  workflowId,
  code: 'pipeline-mixing',
  nameEs: 'Pipeline de mezcla',
  nameEn: 'Mixing pipeline',
  revision: 12,
  serviceOfferings: [{ id: serviceId, code: 'mixing', nameEs: 'Mezcla', nameEn: 'Mixing' }],
  stages: [{ id: stateId, code: 'brief', nameEs: 'Brief', nameEn: 'Brief', sortOrder: 10, terminal: false }],
}];
const cards = [{
  id: '30000000-0000-4000-8000-000000000001',
  title: 'Demo',
  artist: 'DJ',
  serviceOfferingId: serviceId,
  serviceOfferingCode: 'mixing',
  workflowId,
  workflowStateId: stateId,
  workflowStateCode: 'brief',
  workflowStateNameEs: 'Brief',
  workflowStateNameEn: 'Brief',
  sortOrder: 10,
}];

describe('versioned pipeline snapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
  });

  it('persists canonical definitions and cards from the API', async () => {
    mockGet.mockResolvedValueOnce({ revision: 12, definitions, cards });
    const { refreshPipelineSnapshot } = require('../src/api/pipelines') as typeof import('../src/api/pipelines');
    const snapshot = await refreshPipelineSnapshot();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/pipelines/snapshot');
    expect(snapshot.cards[workflowId]?.[0]).toMatchObject({ workflowStateId: stateId, serviceOfferingId: serviceId });
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      'tdf-mobile-pipeline-snapshot-v1',
      expect.any(String),
    );
  });

  it('rejects a card whose state is not in its persisted workflow snapshot', async () => {
    mockGet.mockResolvedValueOnce({
      revision: 12,
      definitions,
      cards: [{ ...cards[0], workflowStateId: '00000000-0000-4000-8000-000000000999' }],
    });
    const { refreshPipelineSnapshot } = require('../src/api/pipelines') as typeof import('../src/api/pipelines');
    await expect(refreshPipelineSnapshot()).rejects.toThrow('Invalid canonical pipeline card');
    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('uses last-known-good data on failure and never invents emergency cards', async () => {
    const cached = {
      schemaVersion: 1,
      revision: 12,
      source: 'network',
      syncedAt: '2026-08-11T00:00:00.000Z',
      definitions,
      cards: { [workflowId]: cards },
    };
    mockGet.mockRejectedValueOnce(new Error('offline'));
    mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cached));
    const { refreshPipelineSnapshot } = require('../src/api/pipelines') as typeof import('../src/api/pipelines');
    await expect(refreshPipelineSnapshot()).resolves.toEqual(expect.objectContaining({ cards: cached.cards }));

    mockGet.mockRejectedValueOnce(new Error('offline'));
    mockAsyncStorage.getItem.mockResolvedValueOnce(null);
    await expect(refreshPipelineSnapshot()).rejects.toThrow('offline');
  });

  it('writes only workflowStateId when moving a card', async () => {
    const cached = {
      schemaVersion: 1,
      revision: 12,
      source: 'network',
      syncedAt: '2026-08-11T00:00:00.000Z',
      definitions,
      cards: { [workflowId]: cards },
    };
    mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cached));
    mockPatch.mockResolvedValueOnce(cards[0]);
    const { updateStage } = require('../src/api/pipelines') as typeof import('../src/api/pipelines');
    await updateStage(workflowId, cards[0]!.id, stateId);
    expect(mockPatch).toHaveBeenCalledWith(`/pipelines/${workflowId}/${cards[0]!.id}`, { workflowStateId: stateId });
  });
});
