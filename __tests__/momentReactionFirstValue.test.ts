import { recordMomentReactionFirstValue } from '../src/lib/momentReactionFirstValue';

describe('moment reaction first value', () => {
  const capture = jest.fn();
  const analytics = { capture };
  const markFirstValue = jest.fn<Promise<boolean>, [string | null | undefined, string, (() => boolean)?]>();

  beforeEach(() => {
    jest.clearAllMocks();
    markFirstValue.mockResolvedValue(true);
  });

  it('completes only after the server acknowledges a selected reaction for the current Party', async () => {
    const stillOwnsParty = jest.fn(() => true);

    await expect(recordMomentReactionFirstValue(
      { source: 'remote', selected: true },
      '7',
      stillOwnsParty,
      analytics,
      markFirstValue,
    )).resolves.toBe(true);

    expect(markFirstValue).toHaveBeenCalledWith('7', 'moment_reaction', stillOwnsParty);
    expect(capture).toHaveBeenNthCalledWith(1, 'first_value_completed', {
      platform: 'mobile',
      value: 'moment_reaction',
    });
    expect(capture).toHaveBeenNthCalledWith(2, 'onboarding_completed', {
      platform: 'mobile',
      reason: 'first_value',
      value: 'moment_reaction',
    });
  });

  it('ignores local fallback and deselection outcomes', async () => {
    await expect(recordMomentReactionFirstValue(
      { source: 'local', selected: true },
      '7',
      () => true,
      analytics,
      markFirstValue,
    )).resolves.toBe(false);
    await expect(recordMomentReactionFirstValue(
      { source: 'remote', selected: false },
      '7',
      () => true,
      analytics,
      markFirstValue,
    )).resolves.toBe(false);

    expect(markFirstValue).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('suppresses stale-account analytics when Party ownership changes during completion', async () => {
    let ownsParty = true;
    let resolveCompletion: ((value: boolean) => void) | undefined;
    markFirstValue.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
      resolveCompletion = resolve;
    }));

    const pending = recordMomentReactionFirstValue(
      { source: 'remote', selected: true },
      '7',
      () => ownsParty,
      analytics,
      markFirstValue,
    );
    ownsParty = false;
    resolveCompletion?.(true);

    await expect(pending).resolves.toBe(false);
    expect(capture).not.toHaveBeenCalled();
  });

  it('keeps completion analytics quiet when the authoritative handshake is not new', async () => {
    markFirstValue.mockResolvedValueOnce(false);

    await expect(recordMomentReactionFirstValue(
      { source: 'remote', selected: true },
      '7',
      () => true,
      analytics,
      markFirstValue,
    )).resolves.toBe(false);

    expect(capture).not.toHaveBeenCalled();
  });
});
