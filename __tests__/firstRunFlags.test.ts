const mockRecordExperimentExposure = jest.fn();

jest.mock('../src/api/experiments', () => ({
  recordExperimentExposure: mockRecordExperimentExposure,
}));

const { markExperimentExposedOnce } = require('../src/lib/firstRunFlags');

describe('first-run experiment exposure', () => {
  beforeEach(() => jest.clearAllMocks());

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
});
