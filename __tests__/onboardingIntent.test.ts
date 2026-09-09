import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearPendingOnboardingIntent,
  markFirstValueCompleted,
  ONBOARDING_INTENT_OPTIONS,
  parseOnboardingIntent,
  PENDING_FIRST_VALUE_KEY_PREFIX,
  persistOnboardingIntent,
  readPendingOnboardingIntent,
  resolveMobileIntentDestination,
  retryPendingFirstValueCompletion,
} from '../src/lib/onboardingIntent';

const mockCompleteOnboardingProgress = jest.fn();
const mockAssertAuthSession = jest.fn();
const mockBinding = { authorization: 'Bearer token', signal: {}, version: 1 };
const mockRequestConfig = { headers: { Authorization: 'Bearer token' } };

jest.mock('../src/api/onboarding', () => ({
  completeOnboardingProgress: (...args: unknown[]) => mockCompleteOnboardingProgress(...args),
}));

jest.mock('../src/api/client', () => ({
  assertAuthSession: (...args: unknown[]) => mockAssertAuthSession(...args),
  authSessionRequestConfig: () => mockRequestConfig,
  captureAuthSession: () => mockBinding,
}));

describe('onboarding intent', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockAssertAuthSession.mockReset();
    await AsyncStorage.clear();
  });

  it('normalizes canonical and legacy campaign values without interpreting arbitrary roles', () => {
    expect(parseOnboardingIntent('follow_artists')).toBe('follow_artists');
    expect(parseOnboardingIntent('Fan')).toBe('follow_artists');
    expect(parseOnboardingIntent('Artista')).toBe('artist_profile');
    expect(parseOnboardingIntent('Admin')).toBeNull();
  });

  it('offers every supported public intent, including internships, as personalization', () => {
    expect(ONBOARDING_INTENT_OPTIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'internships',
        labelEs: 'Buscar prácticas',
        labelEn: 'Find internships',
      }),
    ]));
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
      .mockResolvedValueOnce({
        newlyCompleted: true,
        progress: {
          eligible: false,
          completedAt: '2026-09-09T10:00:00Z',
          firstValue: 'event_saved',
        },
      })
      .mockResolvedValueOnce({
        newlyCompleted: false,
        progress: { eligible: true, completedAt: null, firstValue: null },
      });

    await expect(markFirstValueCompleted('9', 'artist_followed', 'token')).resolves.toBe('event_saved');
    await expect(markFirstValueCompleted('10', 'artist_followed', 'token')).resolves.toBeNull();
    expect(mockCompleteOnboardingProgress).toHaveBeenNthCalledWith(
      1,
      'artist_followed',
      mockRequestConfig,
    );
    expect(mockCompleteOnboardingProgress).toHaveBeenNthCalledWith(
      2,
      'artist_followed',
      mockRequestConfig,
    );
    await expect(AsyncStorage.getItem(`${PENDING_FIRST_VALUE_KEY_PREFIX}9`)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(`${PENDING_FIRST_VALUE_KEY_PREFIX}10`)).resolves.toContain('artist_followed');
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

  it('keeps a Party-bound retry marker when durable completion is unavailable', async () => {
    mockCompleteOnboardingProgress.mockRejectedValueOnce(new Error('offline'));

    await expect(markFirstValueCompleted('9', 'event_saved', 'token')).resolves.toBeNull();
    await expect(markFirstValueCompleted(null, 'event_saved', 'token')).resolves.toBeNull();
    expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(1);
    await expect(AsyncStorage.getItem(`${PENDING_FIRST_VALUE_KEY_PREFIX}9`)).resolves.toContain('event_saved');
  });

  it('replays a pending first value after relaunch and clears it on authoritative completion', async () => {
    mockCompleteOnboardingProgress
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        newlyCompleted: true,
        progress: {
          eligible: false,
          completedAt: '2026-09-09T10:00:00Z',
          firstValue: 'moment_reaction',
        },
      });
    await markFirstValueCompleted('9', 'moment_reaction', 'token');

    await expect(retryPendingFirstValueCompletion('9', 'token')).resolves.toEqual({
      value: 'moment_reaction',
      result: {
        newlyCompleted: true,
        progress: {
          eligible: false,
          completedAt: '2026-09-09T10:00:00Z',
          firstValue: 'moment_reaction',
        },
      },
    });
    expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(2);
    await expect(AsyncStorage.getItem(`${PENDING_FIRST_VALUE_KEY_PREFIX}9`)).resolves.toBeNull();
  });

  it('does not read or send another Party pending first value', async () => {
    mockCompleteOnboardingProgress.mockRejectedValueOnce(new Error('offline'));
    await markFirstValueCompleted('9', 'access_requested', 'token');

    await expect(retryPendingFirstValueCompletion('10', 'token')).resolves.toBeNull();
    expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(1);
    await expect(AsyncStorage.getItem(`${PENDING_FIRST_VALUE_KEY_PREFIX}9`)).resolves.toContain('access_requested');
  });

  it('retains the old Party marker and makes no request after a session replacement', async () => {
    mockAssertAuthSession.mockImplementationOnce(() => {
      throw new Error('session changed');
    });

    await expect(markFirstValueCompleted('9', 'event_saved', 'token')).resolves.toBeNull();
    expect(mockCompleteOnboardingProgress).not.toHaveBeenCalled();
    await expect(AsyncStorage.getItem(`${PENDING_FIRST_VALUE_KEY_PREFIX}9`)).resolves.toContain('event_saved');
  });

  it('still attempts the handshake when local retry storage is unavailable', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage unavailable'));
    mockCompleteOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: {
        eligible: false,
        completedAt: '2026-09-09T10:00:00Z',
        firstValue: 'artist_followed',
      },
    });

    await expect(markFirstValueCompleted('9', 'artist_followed', 'token')).resolves.toBe('artist_followed');
    expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(1);
  });

  it('retains the retry marker when the window expired without durable completion', async () => {
    mockCompleteOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: false,
      progress: { eligible: false, completedAt: null, firstValue: null },
    });

    await expect(markFirstValueCompleted('9', 'event_saved', 'token')).resolves.toBeNull();
    await expect(AsyncStorage.getItem(`${PENDING_FIRST_VALUE_KEY_PREFIX}9`)).resolves.toContain('event_saved');
  });

  it('discards malformed completion metadata without sending a claim', async () => {
    await AsyncStorage.setItem(`${PENDING_FIRST_VALUE_KEY_PREFIX}9`, JSON.stringify({
      version: 1,
      value: 'admin',
    }));

    await expect(retryPendingFirstValueCompletion('9', 'token')).resolves.toBeNull();
    expect(mockCompleteOnboardingProgress).not.toHaveBeenCalled();
    await expect(AsyncStorage.getItem(`${PENDING_FIRST_VALUE_KEY_PREFIX}9`)).resolves.toBeNull();
  });
});
