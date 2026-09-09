import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text, TouchableOpacity } from 'react-native';

const mockCompleteOnboardingProgress = jest.fn();
const mockReconcileOnboardingProgress = jest.fn();
const mockCompleteFirstValueWithRecovery = jest.fn();
const mockClearPendingFirstValueCompletion = jest.fn();
const mockAssertAuthSession = jest.fn();
const mockCapture = jest.fn();
const mockAnalytics = { capture: mockCapture };
let mockBinding = { authorization: 'Bearer token', signal: {}, version: 1 };
const mockRequestConfig = { headers: { Authorization: 'Bearer token' } };
let mockPartyId: string | null = '42';
let mockToken: string | null = 'Bearer token';
let mockConnected = true;

jest.mock('../src/api/onboarding', () => ({
  completeOnboardingProgress: (...args: unknown[]) => mockCompleteOnboardingProgress(...args),
  reconcileOnboardingProgress: (...args: unknown[]) => mockReconcileOnboardingProgress(...args),
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
    mockBinding = { authorization: 'Bearer token', signal: {}, version: 1 };
    mockConnected = true;
    mockReconcileOnboardingProgress.mockReset();
    mockReconcileOnboardingProgress.mockResolvedValue({
      newlyCompleted: false,
      progress: { eligible: true, completedAt: null, firstValue: null },
    });
    mockClearPendingFirstValueCompletion.mockResolvedValue(undefined);
  });

  it('uses authoritative server eligibility for the authenticated party', async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());
    expect(mockReconcileOnboardingProgress).toHaveBeenCalledWith(mockRequestConfig);
  }, 10_000);

  it('fails closed when durable eligibility cannot be loaded', async () => {
    mockReconcileOnboardingProgress.mockRejectedValueOnce(new Error('offline'));

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
  });

  it('does not apply eligibility returned for a replaced auth session', async () => {
    mockAssertAuthSession.mockImplementationOnce(() => {
      throw new Error('session changed');
    });

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
  });

  it('passes first value to the idempotent completion endpoint and exits locally', async () => {
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
    mockCompleteFirstValueWithRecovery.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: { eligible: false },
    });
    mockAssertAuthSession
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

  it('reconciles device-independent evidence and emits completion analytics once', async () => {
    mockReconcileOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: {
        eligible: false,
        completedAt: '2026-09-09T12:00:00Z',
        firstValue: 'event_saved',
      },
    });

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(mockReconcileOnboardingProgress).toHaveBeenCalledWith(mockRequestConfig);
    expect(mockClearPendingFirstValueCompletion).toHaveBeenCalledWith('42', 'Bearer token');
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
    mockReconcileOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: false,
      progress: {
        eligible: false,
        completedAt: '2026-09-09T12:00:00Z',
        firstValue: 'event_saved',
      },
    });

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('serializes a direct completion behind pending same-session reconciliation', async () => {
    let resolveProgress: ((value: {
      newlyCompleted: false;
      progress: { eligible: boolean; completedAt: null; firstValue: null };
    }) => void) | undefined;
    mockReconcileOnboardingProgress.mockReturnValueOnce(new Promise((resolve) => {
      resolveProgress = resolve;
    }));
    mockCompleteFirstValueWithRecovery.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: { eligible: false, completedAt: '2026-09-08T12:00:00Z' },
    });
    renderProvider();

    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));
    expect(mockCompleteFirstValueWithRecovery).not.toHaveBeenCalled();

    await act(async () => {
      resolveProgress?.({
        newlyCompleted: false,
        progress: { eligible: true, completedAt: null, firstValue: null },
      });
    });

    await waitFor(() => expect(mockCompleteFirstValueWithRecovery).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(screen.getByText('true:false')).toBeTruthy();
  });

  it('lets one in-flight reconciliation own a winning receipt and its analytics', async () => {
    let resolveProgress: ((value: {
      newlyCompleted: true;
      progress: { eligible: false; completedAt: string; firstValue: 'event_saved' };
    }) => void) | undefined;
    mockReconcileOnboardingProgress.mockReturnValueOnce(new Promise((resolve) => {
      resolveProgress = resolve;
    }));
    renderProvider();

    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));
    expect(mockCompleteFirstValueWithRecovery).not.toHaveBeenCalled();

    await act(async () => {
      resolveProgress?.({
        newlyCompleted: true,
        progress: {
          eligible: false,
          completedAt: '2026-09-09T12:00:00Z',
          firstValue: 'event_saved',
        },
      });
    });

    await waitFor(() => expect(mockCapture).toHaveBeenCalledTimes(2));
    expect(mockCompleteFirstValueWithRecovery).not.toHaveBeenCalled();
    expect(screen.getByText('true:false')).toBeTruthy();
  });

  it('clears stale metadata without replay when the server already reports completion', async () => {
    mockReconcileOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: false,
      progress: {
        eligible: false,
        completedAt: '2026-09-09T12:00:00Z',
        firstValue: 'artist_followed',
      },
    });

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(mockClearPendingFirstValueCompletion).toHaveBeenCalledWith('42', 'Bearer token');
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('retries when connectivity returns without classifying an offline account as new', async () => {
    mockConnected = false;
    const view = renderProvider();
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(mockReconcileOnboardingProgress).not.toHaveBeenCalled();

    mockConnected = true;
    view.rerender(
      <FirstRunProvider>
        <Probe />
      </FirstRunProvider>,
    );

    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());
    expect(mockReconcileOnboardingProgress).toHaveBeenCalledWith(mockRequestConfig);
  });

  it('retries pending completion when the app returns to the foreground', async () => {
    let onAppStateChange: ((state: 'active') => void) | null = null;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((
      _event,
      listener,
    ) => {
      onAppStateChange = listener as (state: 'active') => void;
      return { remove };
    });
    const view = renderProvider();
    await waitFor(() => expect(mockReconcileOnboardingProgress).toHaveBeenCalledTimes(1));

    act(() => onAppStateChange?.('active'));

    await waitFor(() => expect(mockReconcileOnboardingProgress).toHaveBeenCalledTimes(2));
    view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('coalesces overlapping same-session triggers so the winning receipt is observed once', async () => {
    let onAppStateChange: ((state: 'active') => void) | null = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      onAppStateChange = listener as (state: 'active') => void;
      return { remove: jest.fn() };
    });
    let resolveReconciliation: ((value: {
      newlyCompleted: true;
      progress: { eligible: false; completedAt: string; firstValue: 'event_saved' };
    }) => void) | undefined;
    mockReconcileOnboardingProgress.mockReturnValueOnce(new Promise((resolve) => {
      resolveReconciliation = resolve;
    }));

    renderProvider();
    await waitFor(() => expect(mockReconcileOnboardingProgress).toHaveBeenCalledTimes(1));
    act(() => onAppStateChange?.('active'));
    expect(mockReconcileOnboardingProgress).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveReconciliation?.({
        newlyCompleted: true,
        progress: {
          eligible: false,
          completedAt: '2026-09-09T12:00:00Z',
          firstValue: 'event_saved',
        },
      });
    });

    await waitFor(() => expect(mockCapture).toHaveBeenCalledTimes(2));
    expect(mockReconcileOnboardingProgress).toHaveBeenCalledTimes(1);
  });

  it('does not apply or attribute Party A reconciliation after switching to Party B', async () => {
    let resolvePartyA: ((value: {
      newlyCompleted: true;
      progress: { eligible: false; completedAt: string; firstValue: 'artist_followed' };
    }) => void) | undefined;
    mockReconcileOnboardingProgress
      .mockReturnValueOnce(new Promise((resolve) => {
        resolvePartyA = resolve;
      }))
      .mockResolvedValueOnce({
        newlyCompleted: false,
        progress: { eligible: true, completedAt: null, firstValue: null },
      });
    const view = renderProvider();
    await waitFor(() => expect(mockReconcileOnboardingProgress).toHaveBeenCalledTimes(1));

    mockPartyId = '84';
    mockToken = 'Bearer token-b';
    mockBinding = { authorization: 'Bearer token-b', signal: {}, version: 2 };
    view.rerender(
      <FirstRunProvider>
        <Probe />
      </FirstRunProvider>,
    );
    await waitFor(() => expect(mockReconcileOnboardingProgress).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    await act(async () => {
      resolvePartyA?.({
        newlyCompleted: true,
        progress: {
          eligible: false,
          completedAt: '2026-09-09T12:00:00Z',
          firstValue: 'artist_followed',
        },
      });
    });

    expect(screen.getByText('true:true')).toBeTruthy();
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockClearPendingFirstValueCompletion).not.toHaveBeenCalledWith('84', 'Bearer token-b');
  });

  it('applies authoritative state but emits no analytics for a malformed completion value', async () => {
    mockReconcileOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: {
        eligible: false,
        completedAt: '2026-09-09T12:00:00Z',
        firstValue: null,
      },
    });

    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('does not load or complete progress without an authenticated party', async () => {
    mockPartyId = null;
    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));
    expect(mockReconcileOnboardingProgress).not.toHaveBeenCalled();
    expect(mockCompleteOnboardingProgress).not.toHaveBeenCalled();
    expect(mockCompleteFirstValueWithRecovery).not.toHaveBeenCalled();
  });
});
