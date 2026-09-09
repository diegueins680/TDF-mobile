import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearPendingOnboardingIntent,
  clearPendingOnboardingIntentIfCurrent,
  markFirstValueCompleted,
  ONBOARDING_INTENT_OPTIONS,
  PENDING_FIRST_VALUE_PREFIX,
  parseOnboardingIntent,
  persistOnboardingIntent,
  readPendingOnboardingIntent,
  retryPendingOnboardingIntent,
  retryPendingFirstValueCompletion,
  resolveMobileIntentDestination,
  resolveMobileIntentNavigation,
} from '../src/lib/onboardingIntent';

const mockCompleteOnboardingProgress = jest.fn();
const mockUpdateOnboardingIntent = jest.fn();

jest.mock('../src/api/onboarding', () => ({
  completeOnboardingProgress: (...args: unknown[]) => mockCompleteOnboardingProgress(...args),
  updateOnboardingIntent: (...args: unknown[]) => mockUpdateOnboardingIntent(...args),
}));

describe('onboarding intent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockReset().mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockReset().mockResolvedValue(undefined);
    jest.mocked(AsyncStorage.removeItem).mockReset().mockResolvedValue(undefined);
    mockCompleteOnboardingProgress.mockReset();
    mockUpdateOnboardingIntent.mockReset();
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

  it('routes learning and professional intents to registry-governed public first actions', () => {
    expect(resolveMobileIntentNavigation('learning')).toEqual({
      kind: 'web',
      value: 'https://tdf-app.pages.dev/trials',
    });
    expect(resolveMobileIntentNavigation('professional_tools')).toEqual({
      kind: 'web',
      value: 'https://tdf-app.pages.dev/herramientas/creador-musical',
    });
    expect(resolveMobileIntentNavigation('events')).toEqual({
      kind: 'native',
      value: '/(tabs)/directory',
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

  it('only clears the intent acknowledged by the authenticated session', async () => {
    jest.mocked(AsyncStorage.getItem)
      .mockResolvedValueOnce('events')
      .mockResolvedValueOnce('follow_artists');

    await clearPendingOnboardingIntentIfCurrent('follow_artists');
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

    await clearPendingOnboardingIntentIfCurrent('follow_artists');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('tdf-onboarding-intent:pending');
  });

  it('retries a retained intent only while the authenticated Party still owns it', async () => {
    let stillOwnsParty = true;
    jest.mocked(AsyncStorage.getItem)
      .mockResolvedValueOnce('follow_artists')
      .mockResolvedValueOnce('follow_artists');
    mockUpdateOnboardingIntent.mockImplementationOnce(async () => {
      stillOwnsParty = false;
      return { eligible: false };
    });

    await expect(retryPendingOnboardingIntent(
      '42',
      () => stillOwnsParty,
    )).resolves.toBe(false);

    expect(mockUpdateOnboardingIntent).toHaveBeenCalledWith('follow_artists');
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('clears a retained intent after authenticated recovery succeeds', async () => {
    jest.mocked(AsyncStorage.getItem)
      .mockResolvedValueOnce('internships')
      .mockResolvedValueOnce('internships');
    mockUpdateOnboardingIntent.mockResolvedValueOnce({ eligible: false });

    await expect(retryPendingOnboardingIntent('42')).resolves.toBe(true);

    expect(mockUpdateOnboardingIntent).toHaveBeenCalledWith('internships');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('tdf-onboarding-intent:pending');
  });

  it('retains the intent when authenticated recovery remains offline', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('learning');
    mockUpdateOnboardingIntent.mockRejectedValueOnce(new Error('offline'));

    await expect(retryPendingOnboardingIntent('42')).resolves.toBe(false);

    expect(mockUpdateOnboardingIntent).toHaveBeenCalledWith('learning');
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
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
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `${PENDING_FIRST_VALUE_PREFIX}9`,
      'event_saved',
    );
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(`${PENDING_FIRST_VALUE_PREFIX}9`);
  });

  it('retries a Party-scoped completion handshake and clears it after server acknowledgement', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('moment_reaction');
    mockCompleteOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: { eligible: false },
    });

    await expect(retryPendingFirstValueCompletion('party/9')).resolves.toEqual({
      value: 'moment_reaction',
      result: {
        newlyCompleted: true,
        progress: { eligible: false },
      },
    });

    const key = `${PENDING_FIRST_VALUE_PREFIX}party%2F9`;
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(key);
    expect(mockCompleteOnboardingProgress).toHaveBeenCalledWith('moment_reaction');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(key);
  });

  it('removes invalid pending first-value state without sending it to the server', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('admin_granted');

    await expect(retryPendingFirstValueCompletion('9')).resolves.toBeNull();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`${PENDING_FIRST_VALUE_PREFIX}9`);
    expect(mockCompleteOnboardingProgress).not.toHaveBeenCalled();
  });

  it('does not clear or attribute a completion after the active Party changes', async () => {
    let stillOwnsParty = true;
    mockCompleteOnboardingProgress.mockImplementationOnce(async () => {
      stillOwnsParty = false;
      return { newlyCompleted: true, progress: { eligible: false } };
    });

    await expect(markFirstValueCompleted(
      '9',
      'moment_reaction',
      () => stillOwnsParty,
    )).resolves.toBe(false);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `${PENDING_FIRST_VALUE_PREFIX}9`,
      'moment_reaction',
    );
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(`${PENDING_FIRST_VALUE_PREFIX}9`);
  });
});
