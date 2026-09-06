import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearPendingOnboardingIntent,
  markFirstValueCompleted,
  parseOnboardingIntent,
  persistOnboardingIntent,
  readPendingOnboardingIntent,
  resolveMobileIntentDestination,
} from '../src/lib/onboardingIntent';

const mockCompleteOnboardingProgress = jest.fn();

jest.mock('../src/api/onboarding', () => ({
  completeOnboardingProgress: (...args: unknown[]) => mockCompleteOnboardingProgress(...args),
}));

describe('onboarding intent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('normalizes canonical and legacy campaign values without interpreting arbitrary roles', () => {
    expect(parseOnboardingIntent('follow_artists')).toBe('follow_artists');
    expect(parseOnboardingIntent('Fan')).toBe('follow_artists');
    expect(parseOnboardingIntent('Artista')).toBe('artist_profile');
    expect(parseOnboardingIntent('Admin')).toBeNull();
  });

  it('routes governed intents to access requests unless the returned session is authorized', () => {
    expect(resolveMobileIntentDestination('artist_profile', ['Customer'])).toEqual({
      pathname: '/access-requests/new',
      params: { feature: 'artist.onboarding', action: 'create' },
    });
    expect(resolveMobileIntentDestination('artist_profile', ['Artist'])).toBe('/createArtistProfile');
    expect(resolveMobileIntentDestination('internships', ['Customer'])).toEqual({
      pathname: '/access-requests/new',
      params: { feature: 'internships', action: 'view' },
    });
  });

  it('records first value only when the server atomically claims completion', async () => {
    mockCompleteOnboardingProgress
      .mockResolvedValueOnce({ newlyCompleted: true })
      .mockResolvedValueOnce({ newlyCompleted: false });

    await expect(markFirstValueCompleted('9', 'artist_followed')).resolves.toBe(true);
    await expect(markFirstValueCompleted('10', 'artist_followed')).resolves.toBe(false);
    expect(mockCompleteOnboardingProgress).toHaveBeenNthCalledWith(1, 'artist_followed');
    expect(mockCompleteOnboardingProgress).toHaveBeenNthCalledWith(2, 'artist_followed');
  });

  it('keeps intent only while authentication is pending', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('follow_artists');

    await persistOnboardingIntent('events');
    await expect(readPendingOnboardingIntent()).resolves.toBe('follow_artists');
    await clearPendingOnboardingIntent();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('tdf-onboarding-intent:pending', 'events');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('tdf-onboarding-intent:pending');
  });

  it('discards an invalid pending value instead of restoring a permission-like role', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('Admin');

    await expect(readPendingOnboardingIntent()).resolves.toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('tdf-onboarding-intent:pending');
  });

  it('fails closed when durable completion is unavailable', async () => {
    mockCompleteOnboardingProgress.mockRejectedValueOnce(new Error('offline'));

    await expect(markFirstValueCompleted('9', 'event_saved')).resolves.toBe(false);
    await expect(markFirstValueCompleted(null, 'event_saved')).resolves.toBe(false);
    expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(1);
  });
});
