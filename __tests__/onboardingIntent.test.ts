import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  markFirstValueCompleted,
  parseOnboardingIntent,
  resolveMobileIntentDestination,
} from '../src/lib/onboardingIntent';

describe('onboarding intent', () => {
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

  it('records first value only for a recent, incomplete signup', async () => {
    jest.mocked(AsyncStorage.multiGet)
      .mockResolvedValueOnce([
        ['tdf-signup-completed-at:9', String(Date.now())],
        ['tdf-new-user-onboarding-completed-at:9', null],
      ])
      .mockResolvedValueOnce([
        ['tdf-signup-completed-at:10', null],
        ['tdf-new-user-onboarding-completed-at:10', null],
      ]);
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);

    await expect(markFirstValueCompleted('9', 'artist_followed')).resolves.toBe(true);
    await expect(markFirstValueCompleted('10', 'artist_followed')).resolves.toBe(false);
  });
});
