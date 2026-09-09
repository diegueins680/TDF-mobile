import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, TouchableOpacity } from 'react-native';

const mockGetOnboardingProgress = jest.fn();
const mockCompleteOnboardingProgress = jest.fn();
const mockUpdateOnboardingIntent = jest.fn();
let mockPartyId: string | null = '42';

jest.mock('../src/api/onboarding', () => ({
  getOnboardingProgress: (...args: unknown[]) => mockGetOnboardingProgress(...args),
  completeOnboardingProgress: (...args: unknown[]) => mockCompleteOnboardingProgress(...args),
  updateOnboardingIntent: (...args: unknown[]) => mockUpdateOnboardingIntent(...args),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({ partyId: mockPartyId }),
}));

import { FirstRunProvider, useFirstRun } from '../src/providers/FirstRunProvider';

function Probe() {
  const {
    cohortReady,
    isNewUser,
    completeOnboarding,
    replayedFirstValueCompletion,
  } = useFirstRun();
  return (
    <>
      <Text>{`${cohortReady}:${isNewUser}`}</Text>
      <Text>{replayedFirstValueCompletion?.value ?? 'no-replay'}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Complete first value"
        onPress={() => void completeOnboarding('artist_followed')}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Exit onboarding"
        onPress={() => void completeOnboarding()}
      />
    </>
  );
}

const renderProvider = () => render(
  <FirstRunProvider>
    <Probe />
  </FirstRunProvider>,
);

describe('FirstRunProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockReset().mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockReset().mockResolvedValue(undefined);
    jest.mocked(AsyncStorage.removeItem).mockReset().mockResolvedValue(undefined);
    mockUpdateOnboardingIntent.mockReset().mockResolvedValue({ eligible: false });
    mockPartyId = '42';
  });

  it('uses authoritative server eligibility for the authenticated party', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());
    expect(mockGetOnboardingProgress).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('fails closed when durable eligibility cannot be loaded', async () => {
    mockGetOnboardingProgress.mockRejectedValueOnce(new Error('offline'));

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
  });

  it('passes first value to the idempotent completion endpoint and exits locally', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });
    mockCompleteOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: { eligible: false },
    });
    renderProvider();
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));

    await waitFor(() => expect(mockCompleteOnboardingProgress).toHaveBeenCalledWith('artist_followed'));
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
  });

  it('replays a durable first-value handshake for the active Party before exposing the cohort', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('moment_reaction');
    mockCompleteOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: { eligible: false },
    });

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(screen.getByText('moment_reaction')).toBeTruthy();
    expect(mockCompleteOnboardingProgress).toHaveBeenCalledWith('moment_reaction');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('tdf-onboarding-first-value:party:42');
  });

  it('retries retained intent persistence when an authenticated Party starts', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: false });
    const values = new Map([['tdf-onboarding-intent:pending', 'professional_tools']]);
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) => values.get(key) ?? null);
    jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      values.set(key, value);
    });
    jest.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
      values.delete(key);
    });

    renderProvider();

    await waitFor(() => expect(mockUpdateOnboardingIntent).toHaveBeenCalledWith('professional_tools'));
    await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      'tdf-onboarding-intent:pending',
    ));
    await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      'tdf-onboarding-intent:party:42',
    ));
    expect(values.size).toBe(0);
  });

  it('does not hold cohort readiness while intent recovery is pending', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (key) =>
      key === 'tdf-onboarding-intent:pending' ? 'learning' : null);
    mockUpdateOnboardingIntent.mockReturnValueOnce(new Promise(() => undefined));

    renderProvider();

    await waitFor(() => expect(mockUpdateOnboardingIntent).toHaveBeenCalledWith('learning'));
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());
  });

  it('does not load or complete progress without an authenticated party', async () => {
    mockPartyId = null;
    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));
    expect(mockGetOnboardingProgress).not.toHaveBeenCalled();
    expect(mockCompleteOnboardingProgress).not.toHaveBeenCalled();
  });

  it('fails closed immediately while eligibility for a new Party is unresolved', async () => {
    mockGetOnboardingProgress
      .mockResolvedValueOnce({ eligible: true })
      .mockReturnValueOnce(new Promise(() => undefined));
    const view = renderProvider();
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    mockPartyId = '77';
    view.rerender(
      <FirstRunProvider>
        <Probe />
      </FirstRunProvider>,
    );

    expect(screen.getByText('false:false')).toBeTruthy();
    expect(screen.getByText('no-replay')).toBeTruthy();
  });

  it('ignores a late exit completion after the active Party changes', async () => {
    let resolveCompletion!: (value: {
      newlyCompleted: boolean;
      progress: { eligible: boolean };
    }) => void;
    mockGetOnboardingProgress.mockResolvedValue({ eligible: true });
    mockCompleteOnboardingProgress.mockReturnValueOnce(new Promise((resolve) => {
      resolveCompletion = resolve;
    }));
    const view = renderProvider();
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Exit onboarding' }));
    await waitFor(() => expect(mockCompleteOnboardingProgress).toHaveBeenCalledWith());
    mockPartyId = '77';
    view.rerender(
      <FirstRunProvider>
        <Probe />
      </FirstRunProvider>,
    );
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    resolveCompletion({ newlyCompleted: true, progress: { eligible: false } });

    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());
  });
});
