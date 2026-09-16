import { recordFirstValueCompletion } from '../src/lib/firstValueCompletion';

describe('mobile first value completion', () => {
  const capture = jest.fn();
  const analytics = { capture };
  const markFirstValue = jest.fn<Promise<boolean>, [string | null | undefined, string, (() => boolean)?]>();

  beforeEach(() => {
    jest.clearAllMocks();
    markFirstValue.mockResolvedValue(true);
  });

  it('emits conversion analytics only for a new authoritative completion owned by the current Party', async () => {
    const stillOwnsParty = jest.fn(() => true);

    await expect(recordFirstValueCompletion(
      '42',
      'artist_followed',
      stillOwnsParty,
      analytics,
      markFirstValue,
    )).resolves.toBe(true);

    expect(markFirstValue).toHaveBeenCalledWith('42', 'artist_followed', stillOwnsParty);
    expect(capture).toHaveBeenNthCalledWith(1, 'first_value_completed', {
      platform: 'mobile',
      value: 'artist_followed',
    });
    expect(capture).toHaveBeenNthCalledWith(2, 'onboarding_completed', {
      platform: 'mobile',
      reason: 'first_value',
      value: 'artist_followed',
    });
  });

  it('does not start completion without a valid initiating Party or current ownership', async () => {
    await expect(recordFirstValueCompletion(
      null,
      'event_saved',
      () => true,
      analytics,
      markFirstValue,
    )).resolves.toBe(false);
    await expect(recordFirstValueCompletion(
      '42',
      'event_saved',
      () => false,
      analytics,
      markFirstValue,
    )).resolves.toBe(false);

    expect(markFirstValue).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('suppresses analytics when ownership changes while completion is in flight', async () => {
    let ownsParty = true;
    let resolveCompletion: ((value: boolean) => void) | undefined;
    markFirstValue.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
      resolveCompletion = resolve;
    }));

    const pending = recordFirstValueCompletion(
      '42',
      'access_requested',
      () => ownsParty,
      analytics,
      markFirstValue,
    );
    ownsParty = false;
    resolveCompletion?.(true);

    await expect(pending).resolves.toBe(false);
    expect(capture).not.toHaveBeenCalled();
  });

  it('keeps repeated authoritative completion quiet', async () => {
    markFirstValue.mockResolvedValueOnce(false);

    await expect(recordFirstValueCompletion(
      '42',
      'event_saved',
      () => true,
      analytics,
      markFirstValue,
    )).resolves.toBe(false);

    expect(capture).not.toHaveBeenCalled();
  });
});
