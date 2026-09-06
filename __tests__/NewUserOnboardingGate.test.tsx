import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockTrack = jest.fn();
const mockCapture = jest.fn();
const mockCompleteOnboarding = jest.fn(() => Promise.resolve({
  newlyCompleted: true,
  progress: { eligible: false },
}));
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockMarkExperimentExposedOnce = jest.fn(
  (_partyId: string, _experimentId: string) => Promise.resolve(true),
);

let mockIsConnected = true;
let mockVariant = 'treatment_singlefeature';
let mockEventsState: Record<string, unknown>;
let mockMomentsState: Record<string, unknown>;
let mockProbeState: Record<string, unknown>[];

const pastEvent = { id: 'event-1', title: 'Festival Uno', startTime: '2026-01-01T00:00:00.000Z' };
const moment = { id: 'moment-1', eventId: 'event-1', body: 'Primer momento' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  useQueries: () => mockProbeState,
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => (
    queryKey[1] === 'events' ? mockEventsState : mockMomentsState
  ),
}));

jest.mock('../src/api/events', () => ({ Events: { list: jest.fn() } }));
jest.mock('../src/lib/eventMomentsRepository', () => ({
  listMomentFeed: jest.fn(),
  toggleMomentFeedReaction: jest.fn(),
}));
jest.mock('../src/lib/eventMoments', () => ({
  buildMomentActor: () => ({ actorKey: 'party:42' }),
}));
jest.mock('../src/lib/identity', () => ({ resolvePartyId: () => '42' }));
jest.mock('../src/lib/firstRunFlags', () => ({
  markExperimentExposedOnce: (partyId: string, experimentId: string) => (
    mockMarkExperimentExposedOnce(partyId, experimentId)
  ),
}));
jest.mock('../src/providers/AuthProvider', () => ({ useAuth: () => ({ token: 'Bearer token', partyId: '42' }) }));
jest.mock('../src/providers/FirstRunProvider', () => ({
  useFirstRun: () => ({ cohortReady: true, isNewUser: true, completeOnboarding: mockCompleteOnboarding }),
}));
jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({
    partyId: '42',
    displayName: 'Ana',
    locale: 'es',
    getCatalogItems: () => [{ id: 'like', code: 'like', name: 'Me gusta', nameEs: 'Me gusta', nameEn: 'Like', displaySymbol: '❤️' }],
  }),
}));
jest.mock('../src/providers/NetworkProvider', () => ({ useNetwork: () => ({ isConnected: mockIsConnected }) }));
jest.mock('../src/analytics/AnalyticsProvider', () => ({ useAnalytics: () => ({ capture: mockCapture }) }));
jest.mock('../src/experiments/ExperimentProvider', () => ({
  useExperiments: () => ({
    isReady: true,
    getVariant: () => mockVariant,
    isExperimentEnabled: () => true,
  }),
}));
jest.mock('../src/experiments/useExperimentEvent', () => ({ useExperimentEvent: () => ({ track: mockTrack }) }));
jest.mock('../src/components/EventMomentCard', () => {
  const ReactModule = require('react');
  const { Text: NativeText, TouchableOpacity: NativeTouchableOpacity } = require('react-native');
  return {
    EventMomentCard: ({
      moment: item,
      onReactionPosted,
    }: {
      moment: { id: string };
      onReactionPosted?: () => void;
    }) => (
      ReactModule.createElement(
        NativeTouchableOpacity,
        { accessibilityRole: 'button', accessibilityLabel: 'Post reaction', onPress: onReactionPosted },
        ReactModule.createElement(NativeText, null, `Moment card ${item.id}`),
      )
    ),
  };
});

const { NewUserOnboardingGate } = require('../src/experiments/NewUserOnboardingGate');

const renderGate = () => render(
  <NewUserOnboardingGate><Text>Full app shell</Text></NewUserOnboardingGate>,
);

describe('NewUserOnboardingGate states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConnected = true;
    mockVariant = 'treatment_singlefeature';
    mockEventsState = { data: [], isLoading: false, isError: false };
    mockMomentsState = { data: [], isLoading: false, isError: false };
    mockProbeState = [];
  });

  it('records one-shot treatment exposure after identity and persists explicit exit', async () => {
    mockIsConnected = false;
    renderGate();

    expect(screen.getByRole('header', { name: 'Estás sin conexión' })).toBeTruthy();
    await waitFor(() => expect(mockMarkExperimentExposedOnce).toHaveBeenCalledWith('42', 'single-feature-onboarding-v1'));
    expect(mockTrack).toHaveBeenCalledWith('experiment_viewed', expect.objectContaining({
      experimentId: 'single-feature-onboarding-v1',
      variant: 'treatment_singlefeature',
      userId: '42',
    }));

    fireEvent.press(screen.getByRole('button', { name: 'Ver eventos' }));
    expect(mockCompleteOnboarding).toHaveBeenCalledWith();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/events');
    expect(screen.getByText('Full app shell')).toBeTruthy();
    await waitFor(() => expect(mockCapture).toHaveBeenCalledWith(
      'onboarding_completed',
      { platform: 'mobile', reason: 'explore_events' },
    ));
  });

  it('records control exposure without replacing the full app shell', async () => {
    mockVariant = 'control';
    renderGate();

    expect(screen.getByText('Full app shell')).toBeTruthy();
    await waitFor(() => expect(mockTrack).toHaveBeenCalledWith('experiment_viewed', expect.objectContaining({
      experimentId: 'single-feature-onboarding-v1',
      variant: 'control',
      userId: '42',
    })));
  });

  it.each([
    ['loading', { data: [], isLoading: true, isError: false }, 'Cargando momentos'],
    ['error', { data: [], isLoading: false, isError: true }, 'No pudimos cargar los momentos'],
    ['empty', { data: [], isLoading: false, isError: false }, 'Aún no hay momentos publicados'],
  ])('renders the distinct %s state', (_label, eventsState, expected) => {
    mockEventsState = eventsState;
    renderGate();
    if (expected === 'Cargando momentos') {
      expect(screen.getByLabelText(expected)).toBeTruthy();
    } else {
      expect(screen.getByRole('header', { name: expected })).toBeTruthy();
    }
  });

  it('renders moment content as the success state', () => {
    mockEventsState = { data: [pastEvent], isLoading: false, isError: false };
    mockMomentsState = { data: [moment], isLoading: false, isError: false };
    mockProbeState = [{ data: [moment], isLoading: false, isError: false }];
    renderGate();

    expect(screen.getByText('Moment card moment-1')).toBeTruthy();
    expect(screen.queryByText('Aún no hay momentos publicados')).toBeNull();
  });

  it('emits conversion analytics only when the server newly completes onboarding', async () => {
    mockEventsState = { data: [pastEvent], isLoading: false, isError: false };
    mockMomentsState = { data: [moment], isLoading: false, isError: false };
    mockProbeState = [{ data: [moment], isLoading: false, isError: false }];
    renderGate();

    fireEvent.press(screen.getByRole('button', { name: 'Post reaction' }));

    await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalledWith('moment_reaction'));
    expect(mockTrack).toHaveBeenCalledWith('experiment_converted', expect.objectContaining({
      experimentId: 'single-feature-onboarding-v1',
      variant: 'treatment_singlefeature',
    }));
    expect(mockCapture).toHaveBeenCalledWith(
      'first_value_completed',
      { platform: 'mobile', value: 'moment_reaction' },
    );
  });

  it('suppresses completion analytics when onboarding was already completed', async () => {
    mockCompleteOnboarding.mockResolvedValueOnce({
      newlyCompleted: false,
      progress: { eligible: false },
    });
    mockEventsState = { data: [pastEvent], isLoading: false, isError: false };
    mockMomentsState = { data: [moment], isLoading: false, isError: false };
    mockProbeState = [{ data: [moment], isLoading: false, isError: false }];
    renderGate();

    fireEvent.press(screen.getByRole('button', { name: 'Post reaction' }));

    await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalledWith('moment_reaction'));
    expect(mockTrack).not.toHaveBeenCalledWith('experiment_converted', expect.anything());
    expect(mockCapture).not.toHaveBeenCalledWith('first_value_completed', expect.anything());
    expect(mockCapture).not.toHaveBeenCalledWith('onboarding_completed', expect.anything());
  });
});
