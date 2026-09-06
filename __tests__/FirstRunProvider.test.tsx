import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';

const mockGetOnboardingProgress = jest.fn();
const mockCompleteOnboardingProgress = jest.fn();
let mockPartyId: string | null = '42';

jest.mock('../src/api/onboarding', () => ({
  getOnboardingProgress: (...args: unknown[]) => mockGetOnboardingProgress(...args),
  completeOnboardingProgress: (...args: unknown[]) => mockCompleteOnboardingProgress(...args),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({ partyId: mockPartyId }),
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

  it('does not load or complete progress without an authenticated party', async () => {
    mockPartyId = null;
    renderProvider();

    await waitFor(() => expect(screen.getByText('true:false')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Complete first value' }));
    expect(mockGetOnboardingProgress).not.toHaveBeenCalled();
    expect(mockCompleteOnboardingProgress).not.toHaveBeenCalled();
  });
});
