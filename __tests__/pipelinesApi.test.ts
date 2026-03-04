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

const STORAGE_KEY = 'tdf-mobile-pipeline-stage-overrides-v1';

const loadPipelinesModule = (enabled = true): typeof import('../src/api/pipelines') => {
  process.env.EXPO_PUBLIC_PIPELINES_API_ENABLED = enabled ? 'true' : 'false';
  jest.resetModules();
  return require('../src/api/pipelines');
};

describe('pipelines API normalization', () => {
  let warnSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('normalizes backend stage and kind values', async () => {
    mockGet.mockResolvedValueOnce([
      { id: 'mx-1', title: 'Demo', artist: 'DJ', type: ' Mastering ', stage: 'editing' },
    ]);

    const { listPipeline } = loadPipelinesModule(true);
    const rows = await listPipeline('mixing');

    expect(rows).toEqual([
      {
        id: 'mx-1',
        title: 'Demo',
        artist: 'DJ',
        stage: 'Editing',
        kind: 'mastering',
      },
    ]);
  });

  it('falls back to Intake when API stage is unknown', async () => {
    mockGet.mockResolvedValueOnce([
      { id: 'mx-2', title: 'Unknown Stage', artist: null, type: 'mixing', stage: 'shipped' },
    ]);

    const { listPipeline } = loadPipelinesModule(true);
    const rows = await listPipeline('mixing');

    expect(rows[0]?.stage).toBe('Intake');
  });

  it('sanitizes persisted local stage overrides', async () => {
    mockGet.mockRejectedValueOnce(new Error('api unavailable'));
    mockAsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify({
        'mixing:mx-101': 'editing',
        'mixing:mx-102': 'not-a-stage',
        ' ': 'Mastering',
      }),
    );

    const { listPipeline } = loadPipelinesModule(true);
    const rows = await listPipeline('mixing');

    const card101 = rows.find((row) => String(row.id) === 'mx-101');
    const card102 = rows.find((row) => String(row.id) === 'mx-102');
    expect(card101?.stage).toBe('Editing');
    expect(card102?.stage).toBe('Mixing');
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify({ 'mixing:mx-101': 'Editing' }),
    );
  });

  it('clears malformed local stage overrides', async () => {
    mockGet.mockRejectedValueOnce(new Error('api unavailable'));
    mockAsyncStorage.getItem.mockResolvedValueOnce('{bad-json');

    const { listPipeline } = loadPipelinesModule(true);
    const rows = await listPipeline('mastering');

    expect(rows.length).toBeGreaterThan(0);
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
  });
});
