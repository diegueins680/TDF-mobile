import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import FeatureExplorerScreen from '../app/(tabs)/more';
import { evaluateFeatureAccess, resolveMobileDestination } from '../src/features/featureRegistry';
import { mobileFeatureRegistry } from '../src/features/generatedFeatureRegistry';

const mockPush = jest.fn();
const mockCapture = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: [], isLoading: false })),
  useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useQueryClient: jest.fn(() => ({ setQueryData: jest.fn() })),
}));
jest.mock('../src/analytics/AnalyticsProvider', () => ({ useAnalytics: () => ({ capture: mockCapture }) }));
jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({ token: 'Bearer fan', roles: ['Fan'], modules: [], featureFlags: [], loading: false }),
}));
jest.mock('../src/providers/UserSettingsProvider', () => ({ useUserSettings: () => ({ locale: 'es-EC' }) }));
jest.mock('../src/theme/ThemeProvider', () => ({
  useAppTheme: () => ({ colors: { canvas: '#fff', surface: '#fff', border: '#ccc', textPrimary: '#000', textSecondary: '#555', actionPrimary: '#00f' } }),
}));
jest.mock('../src/api/navigationPreferences', () => ({
  listNavigationPreferences: jest.fn(), recordFeatureVisit: jest.fn(), updateNavigationPreference: jest.fn(),
}));

const fanDecisions = mobileFeatureRegistry
  .filter((feature) => (feature.globalMenu || feature.id === 'social.vcard') && resolveMobileDestination(feature) !== null)
  .map((feature) => evaluateFeatureAccess(feature, { authenticated: true, roles: ['Fan'], modules: [], featureFlags: [] }, 'discover'))
  .filter((decision) => decision.state !== 'concealed');
const lockedCount = fanDecisions.filter((decision) => decision.state === 'locked').length;
const lockedRows = () => screen.queryAllByLabelText(/, bloqueada$/);

describe('Explore for an account with locked features', () => {
  beforeEach(() => jest.clearAllMocks());

  it('has locked features to fold for a fan account', () => {
    expect(lockedCount).toBeGreaterThan(0);
    expect(fanDecisions.length).toBeGreaterThan(lockedCount);
  });

  it('keeps locked rows out of the default menu and reveals them on request', () => {
    render(<FeatureExplorerScreen />);

    expect(lockedRows()).toHaveLength(0);
    fireEvent.press(screen.getByText(`Ver ${lockedCount} más que requieren acceso`));

    expect(mockCapture).toHaveBeenCalledWith('locked_features_revealed', { platform: 'mobile', locked_count: lockedCount });
    expect(screen.queryByText(`Ver ${lockedCount} más que requieren acceso`)).toBeNull();
  });

  it('still finds locked features by search without revealing the rest', () => {
    render(<FeatureExplorerScreen />);
    const locked = fanDecisions.find((decision) => decision.state === 'locked');
    const label = locked?.feature.label.es ?? '';

    fireEvent.changeText(screen.getByLabelText('Buscar funciones'), label);

    expect(screen.queryByText(/más que requieren acceso$/)).toBeNull();
    expect(lockedRows().length).toBeGreaterThan(0);
  });
});
