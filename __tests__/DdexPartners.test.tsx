import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
const mockMutate = jest.fn();
let mockReferenceState: { data?: unknown; isError: boolean; isLoading: boolean };
const mockVersionId = '41000000-0000-4000-8000-000000000001';
const mockVersion = { ddexStandardVersionId: mockVersionId, ddexStandardCode: 'ERN', ddexVersionCode: '4.3.2', ddexStandardDetectionEnabled: true };
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === 'ddex-references' ? mockReferenceState : { data: [], isLoading: false, isError: false },
  useMutation: () => ({ mutate: mockMutate, isPending: false, isError: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('../src/api/ddex', () => ({ createDdexPartner: jest.fn(), getDdexReferences: jest.fn(), listDdexPartners: jest.fn() }));
jest.mock('../src/features/featureRegistry', () => ({ evaluateFeatureAccess: () => ({ state: 'allowed' }) }));
jest.mock('../src/analytics/AnalyticsProvider', () => ({ useAnalytics: () => ({ capture: jest.fn() }) }));
jest.mock('../src/providers/AuthProvider', () => ({ useAuth: () => ({ token: 'synthetic', roles: ['Admin'], modules: ['Catalog'] }) }));
jest.mock('../src/providers/UserSettingsProvider', () => ({ useUserSettings: () => ({ locale: 'en' }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {} }) }));
const Partners = require('../app/ddex/partners').default;

describe('Mobile DDEX partner canonical selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReferenceState = { data: { ddexReferenceStandardVersions: [mockVersion] }, isError: false, isLoading: false };
  });
  it('requires a governed selection and sends its UUID rather than a hardcoded version string', () => {
    render(<Partners />);
    fireEvent.press(screen.getByText('New partner'));
    fireEvent.changeText(screen.getByLabelText('Partner name'), 'Synthetic partner');
    fireEvent.press(screen.getByText('Create partner'));
    expect(mockMutate).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('ERN 4.3.2'));
    fireEvent.press(screen.getByText('Create partner'));
    expect(mockMutate).toHaveBeenCalledWith({ partnerName: 'Synthetic partner', partnerDpid: null, partnerAllowedStandardVersionIds: [mockVersionId] });
  });
  it('cannot submit an option removed by refreshed reference data', () => {
    const view = render(<Partners />);
    fireEvent.press(screen.getByText('New partner'));
    fireEvent.changeText(screen.getByLabelText('Partner name'), 'Synthetic partner');
    fireEvent.press(screen.getByText('ERN 4.3.2'));
    mockReferenceState = { data: { ddexReferenceStandardVersions: [] }, isError: false, isLoading: false };
    view.rerender(<Partners />);
    fireEvent.press(screen.getByText('Create partner'));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText('No enabled standard versions are available.')).toBeTruthy();
  });
  it('reports reference failure without offering fabricated versions', () => {
    mockReferenceState = { isError: true, isLoading: false };
    render(<Partners />);
    fireEvent.press(screen.getByText('New partner'));
    expect(screen.getByText('Standard versions could not be loaded.')).toBeTruthy();
    expect(screen.queryByText('4.3')).toBeNull();
  });
});
