const mockRecordExperimentExposure = jest.fn();

jest.mock('../src/api/experiments', () => ({
  recordExperimentExposure: mockRecordExperimentExposure,
}));

const { markExperimentExposedOnce } = require('../src/lib/firstRunFlags');

describe('first-run experiment exposure', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records experiment exposure only once per party and experiment', async () => {
    mockRecordExperimentExposure
      .mockResolvedValueOnce({ assignment: { experimentEligible: true }, newlyExposed: true })
      .mockResolvedValueOnce({ assignment: { experimentEligible: true }, newlyExposed: false });
    await expect(markExperimentExposedOnce('9', 'onboarding-v1')).resolves.toBe(true);
    await expect(markExperimentExposedOnce('9', 'onboarding-v1')).resolves.toBe(false);
    expect(mockRecordExperimentExposure).toHaveBeenCalledTimes(2);
    expect(mockRecordExperimentExposure).toHaveBeenCalledWith('onboarding-v1');
  });

  it('fails closed for a paused or ineligible server assignment', async () => {
    mockRecordExperimentExposure.mockResolvedValueOnce({
      assignment: { experimentEligible: false },
      newlyExposed: false,
    });

    await expect(markExperimentExposedOnce('9', 'onboarding-v1')).resolves.toBe(false);
  });
});
