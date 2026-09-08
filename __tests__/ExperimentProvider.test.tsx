import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

let mockPartyId: string | null = null;
const mockCapture = jest.fn();
const mockGetExperimentAssignment = jest.fn();

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({ partyId: mockPartyId }),
}));

jest.mock('../src/analytics/posthog', () => ({
  getAnalyticsClient: () => ({ capture: mockCapture }),
}));
jest.mock('../src/api/experiments', () => ({
  getExperimentAssignment: mockGetExperimentAssignment,
}));

const { ExperimentProvider, useExperiments } = require('../src/experiments/ExperimentProvider');

function VariantProbe() {
  const { getVariant, isExperimentEnabled, isReady } = useExperiments();
  if (!isReady) return <Text>loading</Text>;
  const experimentId = 'single-feature-onboarding-v1';
  return <Text>{`${getVariant(experimentId) ?? 'none'}:${isExperimentEnabled(experimentId)}`}</Text>;
}

describe('ExperimentProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPartyId = null;
    mockGetExperimentAssignment.mockResolvedValue({
      experimentId: 'single-feature-onboarding-v1',
      experimentVersion: 1,
      experimentEnabled: false,
      experimentEligible: false,
      variant: 'control',
      assignedAt: null,
      eligibleUntil: null,
      exposedAt: null,
      newlyAssigned: false,
    });
  });

  it('waits for authenticated identity and forces the paused onboarding experiment to control', async () => {
    const view = render(
      <ExperimentProvider><VariantProbe /></ExperimentProvider>,
    );

    await waitFor(() => expect(screen.getByText('none:false')).toBeTruthy());
    expect(mockGetExperimentAssignment).not.toHaveBeenCalled();

    mockPartyId = 'party-42';
    view.rerender(<ExperimentProvider><VariantProbe /></ExperimentProvider>);

    await waitFor(() => expect(screen.getByText('control:false')).toBeTruthy());
    expect(mockGetExperimentAssignment).toHaveBeenCalledWith('single-feature-onboarding-v1');
    expect(mockCapture).not.toHaveBeenCalledWith('experiment_assigned', expect.anything());
  });

  it('uses an eligible server assignment and emits assignment analytics only for the atomic creator', async () => {
    mockPartyId = 'party-42';
    mockGetExperimentAssignment.mockResolvedValueOnce({
      experimentId: 'single-feature-onboarding-v1',
      experimentVersion: 1,
      experimentEnabled: true,
      experimentEligible: true,
      variant: 'treatment_singlefeature',
      assignedAt: '2026-09-07T20:00:00Z',
      eligibleUntil: '2026-09-08T20:00:00Z',
      exposedAt: null,
      newlyAssigned: true,
    });

    render(<ExperimentProvider><VariantProbe /></ExperimentProvider>);

    await waitFor(() => expect(screen.getByText('treatment_singlefeature:true')).toBeTruthy());
    expect(mockCapture).toHaveBeenCalledWith('experiment_assigned', {
      experimentId: 'single-feature-onboarding-v1',
      experimentVersion: 1,
      variant: 'treatment_singlefeature',
      source: 'authenticated_identity_server',
    });
  });

  it('hides the previous Party assignment while an account switch resolves', async () => {
    mockPartyId = 'party-42';
    mockGetExperimentAssignment.mockResolvedValueOnce({
      experimentId: 'single-feature-onboarding-v1',
      experimentVersion: 1,
      experimentEnabled: true,
      experimentEligible: true,
      variant: 'treatment_singlefeature',
      assignedAt: '2026-09-07T20:00:00Z',
      eligibleUntil: '2026-09-08T20:00:00Z',
      exposedAt: null,
      newlyAssigned: false,
    });
    let resolveNextAssignment!: (value: object) => void;
    mockGetExperimentAssignment.mockImplementationOnce(() => new Promise((resolve) => {
      resolveNextAssignment = resolve;
    }));
    const view = render(<ExperimentProvider><VariantProbe /></ExperimentProvider>);
    await waitFor(() => expect(screen.getByText('treatment_singlefeature:true')).toBeTruthy());

    mockPartyId = 'party-43';
    view.rerender(<ExperimentProvider><VariantProbe /></ExperimentProvider>);
    expect(screen.getByText('loading')).toBeTruthy();

    await act(async () => resolveNextAssignment({
      experimentId: 'single-feature-onboarding-v1',
      experimentVersion: 1,
      experimentEnabled: true,
      experimentEligible: true,
      variant: 'control',
      assignedAt: '2026-09-07T20:01:00Z',
      eligibleUntil: '2026-09-08T20:01:00Z',
      exposedAt: null,
      newlyAssigned: false,
    }));
    await waitFor(() => expect(screen.getByText('control:true')).toBeTruthy());
  });
});
