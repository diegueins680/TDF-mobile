import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  NEW_USER_WINDOW_MS,
  markNewUserOnboardingCompleted,
  markExperimentExposedOnce,
  markSignupCompleted,
  resolveNewUserCohort,
} from '../src/lib/firstRunFlags';

describe('first-run eligibility', () => {
  beforeEach(() => jest.clearAllMocks());

  it('qualifies only an actual signup inside the 24-hour window', async () => {
    jest.mocked(AsyncStorage.multiGet).mockResolvedValueOnce([
      ['tdf-signup-completed-at:42', '1000'],
      ['tdf-new-user-onboarding-completed-at:42', null],
    ]);
    await expect(resolveNewUserCohort('42', 1000 + NEW_USER_WINDOW_MS)).resolves.toBe(true);

    jest.mocked(AsyncStorage.multiGet).mockResolvedValueOnce([
      ['tdf-signup-completed-at:42', '1000'],
      ['tdf-new-user-onboarding-completed-at:42', null],
    ]);
    await expect(resolveNewUserCohort('42', 1001 + NEW_USER_WINDOW_MS)).resolves.toBe(false);
  });

  it('never treats an existing login or completed onboarding as new', async () => {
    jest.mocked(AsyncStorage.multiGet)
      .mockResolvedValueOnce([
        ['tdf-signup-completed-at:7', null],
        ['tdf-new-user-onboarding-completed-at:7', null],
      ])
      .mockResolvedValueOnce([
        ['tdf-signup-completed-at:7', '1000'],
        ['tdf-new-user-onboarding-completed-at:7', '1200'],
      ]);
    await expect(resolveNewUserCohort('7', 1100)).resolves.toBe(false);
    await expect(resolveNewUserCohort('7', 1300)).resolves.toBe(false);
  });

  it('persists signup and durable completion timestamps by party', async () => {
    await markSignupCompleted('9', 2000);
    await markNewUserOnboardingCompleted('9', 2500);
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(1, 'tdf-signup-completed-at:9', '2000');
    expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(2, 'tdf-new-user-onboarding-completed-at:9', '2500');
  });

  it('records experiment exposure only once per party and experiment', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null).mockResolvedValueOnce('2000');
    await expect(markExperimentExposedOnce('9', 'onboarding-v1')).resolves.toBe(true);
    await expect(markExperimentExposedOnce('9', 'onboarding-v1')).resolves.toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('tdf-experiment-exposed:9:onboarding-v1', expect.any(String));
  });
});
