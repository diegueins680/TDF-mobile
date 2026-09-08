import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';

const mockGetOnboardingProgress = jest.fn();
const mockCompleteOnboardingProgress = jest.fn();
const mockAssertAuthSession = jest.fn();
const mockBinding = { authorization: 'Bearer token', signal: {}, version: 1 };
const mockRequestConfig = { headers: { Authorization: 'Bearer token' } };
let mockPartyId: string | null = '42';
let mockToken: string | null = 'Bearer token';

jest.mock('../src/api/onboarding', () => ({
  getOnboardingProgress: (...args: unknown[]) => mockGetOnboardingProgress(...args),
  completeOnboardingProgress: (...args: unknown[]) => mockCompleteOnboardingProgress(...args),
}));

jest.mock('../src/api/client', () => ({
  assertAuthSession: (...args: unknown[]) => mockAssertAuthSession(...args),
  authSessionRequestConfig: () => mockRequestConfig,
  captureAuthSession: () => mockBinding,
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
    mockPartyId = '42';
    mockToken = 'Bearer token';
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
    mockCompleteOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: true,
      progress: { eligible: false },
    });
    renderProvider();
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));

    await waitFor(() => expect(mockCompleteOnboardingProgress).toHaveBeenCalledWith(
      'artist_followed',
      mockRequestConfig,
    ));
    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
  });

  it('retains first-run eligibility when server evidence is still pending', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });
    mockCompleteOnboardingProgress.mockResolvedValueOnce({
      newlyCompleted: false,
      progress: { eligible: true },
    });
    renderProvider();
    await waitFor(() => expect(screen.getByText('true:true')).toBeTruthy());

    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));

    await waitFor(() => expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(1));
    expect(screen.getByText('true:true')).toBeTruthy();
  });

  it('does not apply an old completion after the auth session changes', async () => {
    mockGetOnboardingProgress.mockResolvedValueOnce({ eligible: true });
    mockCompleteOnboardingProgress.mockResolvedValueOnce({
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

    await waitFor(() => expect(mockCompleteOnboardingProgress).toHaveBeenCalledTimes(1));
    expect(screen.getByText('true:true')).toBeTruthy();
  });

  it('does not load or complete progress without an authenticated party', async () => {
    mockPartyId = null;
    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));
    expect(mockGetOnboardingProgress).not.toHaveBeenCalled();
    expect(mockCompleteOnboardingProgress).not.toHaveBeenCalled();
  });
});
