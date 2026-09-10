const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();

jest.mock('../src/api/client', () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
  put: (...args: unknown[]) => mockPut(...args),
}));

import {
  completeOnboardingProgress,
  getOnboardingProgress,
  updateOnboardingIntent,
} from '../src/api/onboarding';

describe('onboarding API client', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads account-bound onboarding progress', async () => {
    const progress = {
      eligible: true,
      signupCompletedAt: '2026-09-06T12:00:00Z',
      onboardingIntent: 'events',
      completedAt: null,
      firstValue: null,
      firstValueCompletedAt: null,
      updatedAt: '2026-09-06T12:00:00Z',
    };
    mockGet.mockResolvedValueOnce(progress);

    await expect(getOnboardingProgress()).resolves.toEqual(progress);
    expect(mockGet).toHaveBeenCalledWith('/session/onboarding');
  });

  it('persists product intent without sending role or permission fields', async () => {
    mockPut.mockResolvedValueOnce({ eligible: true, onboardingIntent: 'follow_artists' });

    await updateOnboardingIntent('follow_artists');

    expect(mockPut).toHaveBeenCalledWith('/session/onboarding/intent', {
      onboardingIntent: 'follow_artists',
    });
  });

  it('sends a first-value completion and supports explicit exit', async () => {
    mockPost
      .mockResolvedValueOnce({ newlyCompleted: true, progress: {} })
      .mockResolvedValueOnce({ newlyCompleted: false, progress: {} });

    await completeOnboardingProgress('event_saved');
    await completeOnboardingProgress();

    expect(mockPost).toHaveBeenNthCalledWith(1, '/session/onboarding/complete', {
      firstValue: 'event_saved',
    });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/session/onboarding/complete', {});
  });
});
