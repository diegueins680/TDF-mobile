import AsyncStorage from '@react-native-async-storage/async-storage';

import { markExperimentExposedOnce } from '../src/lib/firstRunFlags';

describe('first-run experiment exposure', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records experiment exposure only once per party and experiment', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null).mockResolvedValueOnce('2000');
    await expect(markExperimentExposedOnce('9', 'onboarding-v1')).resolves.toBe(true);
    await expect(markExperimentExposedOnce('9', 'onboarding-v1')).resolves.toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('tdf-experiment-exposed:9:onboarding-v1', expect.any(String));
  });
});
