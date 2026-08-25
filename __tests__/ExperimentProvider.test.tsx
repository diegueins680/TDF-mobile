import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

let mockPartyId: string | null = null;
const mockCapture = jest.fn();

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({ partyId: mockPartyId }),
}));

jest.mock('../src/analytics/posthog', () => ({
  getAnalyticsClient: () => ({ capture: mockCapture }),
}));

const { ExperimentProvider, useExperiments } = require('../src/experiments/ExperimentProvider');

function VariantProbe() {
  const { getVariant, isReady } = useExperiments();
  return <Text>{isReady ? getVariant('single-feature-onboarding-v1') ?? 'none' : 'loading'}</Text>;
}

describe('ExperimentProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPartyId = null;
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });

  it('waits for authenticated identity and forces the paused onboarding experiment to control', async () => {
    const view = render(
      <ExperimentProvider><VariantProbe /></ExperimentProvider>,
    );

    await waitFor(() => expect(screen.getByText('none')).toBeTruthy());
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();

    mockPartyId = 'party-42';
    view.rerender(<ExperimentProvider><VariantProbe /></ExperimentProvider>);

    await waitFor(() => expect(screen.getByText('control')).toBeTruthy());
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@experiments:variants',
      expect.stringContaining('party-42:single-feature-onboarding-v1'),
    );
    expect(mockCapture).not.toHaveBeenCalledWith('experiment_assigned', expect.anything());
  });
});
