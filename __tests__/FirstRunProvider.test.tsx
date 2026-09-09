import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus, Text, TouchableOpacity } from 'react-native';

const mockGetOnboardingProgress = jest.fn();
const mockCompleteOnboardingProgress = jest.fn();
const mockUpdateOnboardingIntent = jest.fn();
let mockPartyId: string | null = '42';
let mockIsConnected = true;
let appStateChangeListener: ((state: AppStateStatus) => void) | null = null;
const mockRemoveAppStateListener = jest.fn();
const mockAddAppStateListener = jest.spyOn(AppState, 'addEventListener');

jest.mock('../src/api/onboarding', () => ({
  getOnboardingProgress: (...args: unknown[]) => mockGetOnboardingProgress(...args),
  completeOnboardingProgress: (...args: unknown[]) => mockCompleteOnboardingProgress(...args),
  updateOnboardingIntent: (...args: unknown[]) => mockUpdateOnboardingIntent(...args),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({ partyId: mockPartyId }),
}));

jest.mock('../src/providers/NetworkProvider', () => ({
  useNetwork: () => ({ isConnected: mockIsConnected, connectionType: 'internet' }),
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

const emitAppStateChange = (state: AppStateStatus) => {
  if (!appStateChangeListener) throw new Error('AppState listener was not registered');
  appStateChangeListener(state);
};

describe('FirstRunProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOnboardingProgress.mockReset().mockResolvedValue({ eligible: false });
    mockCompleteOnboardingProgress.mockReset().mockResolvedValue({
      newlyCompleted: false,
      progress: { eligible: false },
    });
    jest.mocked(AsyncStorage.getItem).mockReset().mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockReset().mockResolvedValue(undefined);
    jest.mocked(AsyncStorage.removeItem).mockReset().mockResolvedValue(undefined);
    mockUpdateOnboardingIntent.mockReset().mockResolvedValue({ eligible: false });
    appStateChangeListener = null;
    mockRemoveAppStateListener.mockReset();
    mockAddAppStateListener.mockReset().mockImplementation((_event, listener) => {
      appStateChangeListener = listener;
      return { remove: mockRemoveAppStateListener };
    });
    mockPartyId = '42';
    mockIsConnected = true;
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

  it('retries a retained Party intent when the app returns to the foreground', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: false });
    const key = 'tdf-onboarding-intent:party:42';
    const values = new Map([[key, 'learning']]);
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (storageKey) =>
      values.get(storageKey) ?? null);
    jest.mocked(AsyncStorage.removeItem).mockImplementation(async (storageKey) => {
      values.delete(storageKey);
    });
    let rejectStartupAttempt!: (reason: Error) => void;
    mockUpdateOnboardingIntent.mockReturnValueOnce(new Promise((_resolve, reject) => {
      rejectStartupAttempt = reject;
    }));

    renderProvider();
    await waitFor(() => expect(mockUpdateOnboardingIntent).toHaveBeenCalledTimes(1));
    await act(async () => {
      rejectStartupAttempt(new Error('offline'));
      await Promise.resolve();
    });

    act(() => emitAppStateChange('active'));

    await waitFor(() => expect(mockUpdateOnboardingIntent).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(values.has(key)).toBe(false));
  });

  it('coalesces foreground intent recovery while the active Party request is pending', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: false });
    const key = 'tdf-onboarding-intent:party:42';
    const values = new Map([[key, 'professional_tools']]);
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (storageKey) =>
      values.get(storageKey) ?? null);
    jest.mocked(AsyncStorage.removeItem).mockImplementation(async (storageKey) => {
      values.delete(storageKey);
    });
    let resolveUpdate!: (result: { eligible: boolean }) => void;
    mockUpdateOnboardingIntent.mockReturnValueOnce(new Promise((resolve) => {
      resolveUpdate = resolve;
    }));

    renderProvider();
    await waitFor(() => expect(mockUpdateOnboardingIntent).toHaveBeenCalledTimes(1));

    act(() => {
      emitAppStateChange('active');
      emitAppStateChange('active');
    });
    expect(mockUpdateOnboardingIntent).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveUpdate({ eligible: false });
      await Promise.resolve();
    });
    await waitFor(() => expect(values.has(key)).toBe(false));
  });

  it('retries a retained first-value completion when the app returns to the foreground', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });
    const key = 'tdf-onboarding-first-value:party:42';
    const values = new Map([[key, 'moment_reaction']]);
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (storageKey) =>
      values.get(storageKey) ?? null);
    jest.mocked(AsyncStorage.removeItem).mockImplementation(async (storageKey) => {
      values.delete(storageKey);
    });
    mockCompleteOnboardingProgress
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        newlyCompleted: true,
        progress: { eligible: false },
      });

    renderProvider();
    await waitFor(() => expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    act(() => emitAppStateChange('active'));

    await waitFor(() => expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(screen.getByText('moment_reaction')).toBeTruthy();
    expect(values.has(key)).toBe(false);
  });

  it('coalesces foreground first-value recovery while the Party request is pending', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });
    const key = 'tdf-onboarding-first-value:party:42';
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (storageKey) =>
      storageKey === key ? 'event_saved' : null);
    let resolveCompletion!: (result: {
      newlyCompleted: boolean;
      progress: { eligible: boolean };
    }) => void;
    mockCompleteOnboardingProgress.mockReturnValueOnce(new Promise((resolve) => {
      resolveCompletion = resolve;
    }));

    renderProvider();
    await waitFor(() => expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(1));

    act(() => {
      emitAppStateChange('active');
      emitAppStateChange('active');
    });
    expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCompletion({ newlyCompleted: true, progress: { eligible: false } });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(screen.getByText('event_saved')).toBeTruthy();
  });

  it('does not let late eligibility reopen onboarding after a foreground replay', async () => {
    let resolveProgress!: (progress: { eligible: boolean }) => void;
    mockGetOnboardingProgress.mockReturnValueOnce(new Promise((resolve) => {
      resolveProgress = resolve;
    }));
    const key = 'tdf-onboarding-first-value:party:42';
    const values = new Map([[key, 'moment_reaction']]);
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (storageKey) =>
      values.get(storageKey) ?? null);
    jest.mocked(AsyncStorage.removeItem).mockImplementation(async (storageKey) => {
      values.delete(storageKey);
    });
    mockCompleteOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: { eligible: false },
    });

    renderProvider();
    act(() => emitAppStateChange('active'));
    await waitFor(() => expect(screen.getByText('moment_reaction')).toBeTruthy());

    await act(async () => {
      resolveProgress({ eligible: true });
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(screen.getByText('moment_reaction')).toBeTruthy();
  });

  it('reloads authoritative eligibility after an offline startup returns to the foreground', async () => {
    mockGetOnboardingProgress
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ eligible: true });

    renderProvider();
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());

    act(() => emitAppStateChange('active'));

    await waitFor(() => expect(mockGetOnboardingProgress).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());
  });

  it('coalesces repeated foreground eligibility loads for the active Party', async () => {
    let resolveProgress!: (progress: { eligible: boolean }) => void;
    mockGetOnboardingProgress.mockReturnValueOnce(new Promise((resolve) => {
      resolveProgress = resolve;
    }));

    renderProvider();
    act(() => {
      emitAppStateChange('active');
      emitAppStateChange('active');
    });

    expect(mockGetOnboardingProgress).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveProgress({ eligible: true });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());
  });

  it('does not let an older foreground eligibility response reopen an exited Party', async () => {
    let resolveForegroundProgress!: (progress: { eligible: boolean }) => void;
    mockGetOnboardingProgress
      .mockResolvedValueOnce({ eligible: true })
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveForegroundProgress = resolve;
      }));
    mockCompleteOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: { eligible: false },
    });
    renderProvider();
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    act(() => emitAppStateChange('active'));
    await waitFor(() => expect(mockGetOnboardingProgress).toHaveBeenCalledTimes(2));
    fireEvent.press(screen.getByRole('button', { name: 'Exit onboarding' }));
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());

    await act(async () => {
      resolveForegroundProgress({ eligible: true });
      await Promise.resolve();
    });

    expect(screen.getByText('true:false')).toBeTruthy();
  });

  it('keeps onboarding exited for the Party session when durable completion fails', async () => {
    mockGetOnboardingProgress.mockResolvedValue({ eligible: true });
    mockCompleteOnboardingProgress.mockRejectedValueOnce(new Error('offline'));
    renderProvider();
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Exit onboarding' }));
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    act(() => emitAppStateChange('active'));

    await waitFor(() => expect(mockGetOnboardingProgress).toHaveBeenCalledTimes(2));
    expect(screen.getByText('true:false')).toBeTruthy();
  });

  it('loads eligibility normally for a new Party after the prior Party exits', async () => {
    mockGetOnboardingProgress.mockResolvedValue({ eligible: true });
    const view = renderProvider();
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Exit onboarding' }));
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    mockPartyId = '77';
    view.rerender(
      <FirstRunProvider>
        <Probe />
      </FirstRunProvider>,
    );

    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());
  });

  it('recovers retained Party work when connectivity returns without an app-state change', async () => {
    mockIsConnected = false;
    const intentKey = 'tdf-onboarding-intent:party:42';
    const firstValueKey = 'tdf-onboarding-first-value:party:42';
    const values = new Map([
      [intentKey, 'learning'],
      [firstValueKey, 'event_saved'],
    ]);
    jest.mocked(AsyncStorage.getItem).mockImplementation(async (storageKey) =>
      values.get(storageKey) ?? null);
    jest.mocked(AsyncStorage.removeItem).mockImplementation(async (storageKey) => {
      values.delete(storageKey);
    });
    mockGetOnboardingProgress
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ eligible: true });
    mockUpdateOnboardingIntent
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ eligible: false });
    mockCompleteOnboardingProgress
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        newlyCompleted: true,
        progress: { eligible: false },
      });
    const view = renderProvider();
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    expect(mockUpdateOnboardingIntent).toHaveBeenCalledTimes(1);
    expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(1);

    mockIsConnected = true;
    view.rerender(
      <FirstRunProvider>
        <Probe />
      </FirstRunProvider>,
    );

    await waitFor(() => expect(mockGetOnboardingProgress).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockUpdateOnboardingIntent).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('event_saved')).toBeTruthy());
    expect(screen.getByText('true:false')).toBeTruthy();
    expect(values.size).toBe(0);
  });

  it('coalesces reconnect and foreground recovery for the active Party', async () => {
    mockIsConnected = false;
    let resolveProgress!: (progress: { eligible: boolean }) => void;
    mockGetOnboardingProgress.mockReturnValueOnce(new Promise((resolve) => {
      resolveProgress = resolve;
    }));
    const view = renderProvider();
    expect(mockGetOnboardingProgress).toHaveBeenCalledTimes(1);

    mockIsConnected = true;
    view.rerender(
      <FirstRunProvider>
        <Probe />
      </FirstRunProvider>,
    );
    act(() => emitAppStateChange('active'));

    expect(mockGetOnboardingProgress).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveProgress({ eligible: true });
      await Promise.resolve();
    });
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
