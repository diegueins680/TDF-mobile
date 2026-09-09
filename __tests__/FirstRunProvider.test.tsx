import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';

const mockGetOnboardingProgress = jest.fn();
const mockCompleteOnboardingProgress = jest.fn();
const mockCompleteFirstValueWithRecovery = jest.fn();
const mockRetryPendingFirstValueCompletion = jest.fn();
const mockClearPendingFirstValueCompletion = jest.fn();
const mockAssertAuthSession = jest.fn();
const mockCapture = jest.fn();
const mockAnalytics = { capture: mockCapture };
const mockBinding = { authorization: 'Bearer token', signal: {}, version: 1 };
const mockRequestConfig = { headers: { Authorization: 'Bearer token' } };
let mockPartyId: string | null = '42';
let mockToken: string | null = 'Bearer token';
let mockConnected = true;

jest.mock('../src/api/onboarding', () => ({
  getOnboardingProgress: (...args: unknown[]) => mockGetOnboardingProgress(...args),
  completeOnboardingProgress: (...args: unknown[]) => mockCompleteOnboardingProgress(...args),
}));

jest.mock('../src/api/client', () => ({
  assertAuthSession: (...args: unknown[]) => mockAssertAuthSession(...args),
  authSessionRequestConfig: () => mockRequestConfig,
  captureAuthSession: () => mockBinding,
}));

jest.mock('../src/analytics/AnalyticsProvider', () => ({
  useAnalytics: () => mockAnalytics,
}));

jest.mock('../src/lib/onboardingIntent', () => ({
  clearPendingFirstValueCompletion: (...args: unknown[]) => mockClearPendingFirstValueCompletion(...args),
  completeFirstValueWithRecovery: (...args: unknown[]) => mockCompleteFirstValueWithRecovery(...args),
  retryPendingFirstValueCompletion: (...args: unknown[]) => mockRetryPendingFirstValueCompletion(...args),
}));

jest.mock('../src/providers/NetworkProvider', () => ({
  useNetwork: () => ({ isConnected: mockConnected }),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({ partyId: mockPartyId, token: mockToken }),
}));

import { FirstRunProvider, useFirstRun } from '../src/providers/FirstRunProvider';

function Probe() {
  const { cohortReady, isNewUser, completeOnboarding } = useFirstRun();
  return (
    <>
      <Text>{`${cohortReady}:${isNewUser}`}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Complete first value"
        onPress={() => void completeOnboarding('artist_followed')}
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
    mockAssertAuthSession.mockReset();
    mockPartyId = '42';
    mockToken = 'Bearer token';
    mockConnected = true;
    mockRetryPendingFirstValueCompletion.mockResolvedValue(null);
    mockClearPendingFirstValueCompletion.mockResolvedValue(undefined);
  });

  it('uses authoritative server eligibility for the authenticated party', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());
    expect(mockGetOnboardingProgress).toHaveBeenCalledWith(mockRequestConfig);
  }, 10_000);

  it('fails closed when durable eligibility cannot be loaded', async () => {
    mockGetOnboardingProgress.mockRejectedValueOnce(new Error('offline'));

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
  });

  it('does not apply eligibility returned for a replaced auth session', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });
    mockAssertAuthSession.mockImplementationOnce(() => {
      throw new Error('session changed');
    });

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
  });

  it('passes first value to the idempotent completion endpoint and exits locally', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });
    mockCompleteFirstValueWithRecovery.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: { eligible: false },
    });
    renderProvider();
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));

    await waitFor(() => expect(mockCompleteFirstValueWithRecovery).toHaveBeenCalledWith(
      '42',
      'artist_followed',
      'Bearer token',
    ));
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
  });

  it('retains first-run eligibility when server evidence is still pending', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });
    mockCompleteFirstValueWithRecovery.mockResolvedValueOnce({
      newlyCompleted: false,
      progress: { eligible: true },
    });
    renderProvider();
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));

    await waitFor(() => expect(mockCompleteFirstValueWithRecovery).toHaveBeenCalledTimes(1));
    expect(screen.getByText('true:true')).toBeTruthy();
  });

  it('does not apply an old completion after the auth session changes', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });
    mockCompleteFirstValueWithRecovery.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: { eligible: false },
    });
    mockAssertAuthSession
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error('session changed');
      });
    renderProvider();
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));

    await waitFor(() => expect(mockCompleteFirstValueWithRecovery).toHaveBeenCalledTimes(1));
    expect(screen.getByText('true:true')).toBeTruthy();
  });

  it('replays a pending completion after hydration and emits completion analytics once', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true, completedAt: null });
    mockRetryPendingFirstValueCompletion.mockResolvedValueOnce({
      value: 'event_saved',
      result: {
        newlyCompleted: true,
        progress: { eligible: false, completedAt: '2026-09-08T12:00:00Z' },
      },
    });

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(mockRetryPendingFirstValueCompletion).toHaveBeenCalledWith('42', 'Bearer token');
    expect(mockCapture).toHaveBeenNthCalledWith(1, 'first_value_completed', {
      platform: 'mobile',
      value: 'event_saved',
    });
    expect(mockCapture).toHaveBeenNthCalledWith(2, 'onboarding_completed', {
      platform: 'mobile',
      reason: 'first_value',
      value: 'event_saved',
    });
  });

  it('does not invent analytics when another request already completed the pending value', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true, completedAt: null });
    mockRetryPendingFirstValueCompletion.mockResolvedValueOnce({
      value: 'event_saved',
      result: {
        newlyCompleted: false,
        progress: { eligible: false, completedAt: '2026-09-08T12:00:00Z' },
      },
    });

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('does not let an older eligibility response reopen onboarding after completion', async () => {
    let resolveProgress: ((value: { eligible: boolean; completedAt: null }) => void) | undefined;
    mockGetOnboardingProgress.mockReturnValueOnce(new Promise((resolve) => {
      resolveProgress = resolve;
    }));
    mockCompleteFirstValueWithRecovery.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: { eligible: false, completedAt: '2026-09-08T12:00:00Z' },
    });
    renderProvider();

    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());

    await act(async () => {
      resolveProgress?.({ eligible: true, completedAt: null });
    });
    expect(screen.getByText('true:false')).toBeTruthy();
  });

  it('clears stale metadata without replay when the server already reports completion', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({
      eligible: false,
      completedAt: '2026-09-08T12:00:00Z',
    });

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(mockClearPendingFirstValueCompletion).toHaveBeenCalledWith('42', 'Bearer token');
    expect(mockRetryPendingFirstValueCompletion).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('retries when connectivity returns without classifying an offline account as new', async () => {
    mockConnected = false;
    const view = renderProvider();
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(mockGetOnboardingProgress).not.toHaveBeenCalled();

    mockConnected = true;
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true, completedAt: null });
    view.rerender(
      <FirstRunProvider>
        <Probe />
      </FirstRunProvider>,
    );

    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());
    expect(mockRetryPendingFirstValueCompletion).toHaveBeenCalledWith('42', 'Bearer token');
  });

  it('does not load or complete progress without an authenticated party', async () => {
    mockPartyId = null;
    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));
    expect(mockGetOnboardingProgress).not.toHaveBeenCalled();
    expect(mockCompleteOnboardingProgress).not.toHaveBeenCalled();
    expect(mockCompleteFirstValueWithRecovery).not.toHaveBeenCalled();
  });
});
