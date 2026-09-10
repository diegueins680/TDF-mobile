import AsyncStorage from '@react-native-async-storage/async-storage';

const mockRecordExperimentExposure = jest.fn();

jest.mock('../src/api/experiments', () => ({
  recordExperimentExposure: mockRecordExperimentExposure,
}));

const {
  clearPendingExperimentConversionIfCurrent,
  markExperimentExposedOnce,
  persistPendingExperimentConversion,
  readPendingExperimentConversion,
} = require('../src/lib/firstRunFlags');

const conversion = {
  experimentId: 'single-feature-onboarding-v1',
  experimentVersion: 3,
  variant: 'treatment_singlefeature',
  firstValue: 'moment_reaction',
};

describe('first-run experiment exposure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockReset().mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockReset().mockResolvedValue(undefined);
    jest.mocked(AsyncStorage.removeItem).mockReset().mockResolvedValue(undefined);
  });

  it('records experiment exposure only once per party and experiment', async () => {
    const first = { assignment: { experimentEligible: true }, newlyExposed: true };
    const repeated = { assignment: { experimentEligible: true }, newlyExposed: false };
    mockRecordExperimentExposure
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(repeated);
    await expect(markExperimentExposedOnce('9', 'onboarding-v1')).resolves.toBe(first);
    await expect(markExperimentExposedOnce('9', 'onboarding-v1')).resolves.toBe(repeated);
    expect(mockRecordExperimentExposure).toHaveBeenCalledTimes(2);
    expect(mockRecordExperimentExposure).toHaveBeenCalledWith('onboarding-v1');
  });

  it('fails closed for a paused or ineligible server assignment', async () => {
    mockRecordExperimentExposure.mockResolvedValueOnce({
      assignment: { experimentEligible: false },
      newlyExposed: false,
    });

    await expect(markExperimentExposedOnce('9', 'onboarding-v1')).resolves.toEqual({
      assignment: { experimentEligible: false },
      newlyExposed: false,
    });
  });

  it('returns no acknowledgement when exposure persistence is unavailable', async () => {
    mockRecordExperimentExposure.mockRejectedValueOnce(new Error('offline'));

    await expect(markExperimentExposedOnce('9', 'onboarding-v1')).resolves.toBeNull();
  });

  it('persists and reloads versioned conversion attribution for its Party', async () => {
    const key = 'tdf-onboarding-experiment-conversion:party:9:single-feature-onboarding-v1';
    const values = new Map<string, string>();
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (storageKey, value) => {
      values.set(storageKey, value);
    });
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (storageKey) =>
      values.get(storageKey) ?? null);

    await expect(persistPendingExperimentConversion('9', conversion)).resolves.toBe(true);
    await expect(readPendingExperimentConversion('9', conversion.experimentId)).resolves.toEqual(
      conversion,
    );
    expect(values.get(key)).toBe(JSON.stringify(conversion));
  });

  it('clears only the exact conversion receipt acknowledged by analytics', async () => {
    const key = 'tdf-onboarding-experiment-conversion:party:9:single-feature-onboarding-v1';
    const values = new Map([[key, JSON.stringify(conversion)]]);
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (storageKey) =>
      values.get(storageKey) ?? null);
    jest.mocked(AsyncStorage.removeItem).mockImplementation(async (storageKey) => {
      values.delete(storageKey);
    });

    await clearPendingExperimentConversionIfCurrent('9', {
      ...conversion,
      experimentVersion: 2,
    });
    expect(values.has(key)).toBe(true);

    await clearPendingExperimentConversionIfCurrent('9', conversion);
    expect(values.has(key)).toBe(false);
  });

  it('removes malformed attribution without returning it', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify({
      ...conversion,
      experimentVersion: 0,
    }));

    await expect(readPendingExperimentConversion('9', conversion.experimentId)).resolves.toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      'tdf-onboarding-experiment-conversion:party:9:single-feature-onboarding-v1',
    );
  });

  it('retains Party attribution when session ownership changes during a read', async () => {
    let ownsParty = true;
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(async () => {
      ownsParty = false;
      return JSON.stringify(conversion);
    });

    await expect(readPendingExperimentConversion(
      '9',
      conversion.experimentId,
      () => ownsParty,
    )).resolves.toBeNull();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });
});
