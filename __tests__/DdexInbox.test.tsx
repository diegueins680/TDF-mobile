import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
const mockQueries: { queryKey: unknown[]; queryFn: () => unknown }[] = [];
const mockList = jest.fn();
const mockStateId = '42000000-0000-4000-8000-000000000001';
const mockDocument = { ddexDocumentId: 7, ddexDocumentFileName: 'synthetic.xml', ddexDocumentStandardCode: 'ERN', ddexDocumentVersionCode: '4.3.2', ddexDocumentWorkflowStateCode: 'mapping_required', ddexDocumentWorkflowStateNameEn: 'Awaiting mapping', ddexDocumentWorkflowStateNameEs: 'Requiere mapeo' };
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@tanstack/react-query', () => ({ useQuery: (options: { queryKey: unknown[]; queryFn: () => unknown }) => {
  mockQueries.push(options);
  return { data: options.queryKey[0] === 'ddex-references'
    ? { ddexReferenceDocumentStates: [{ ddexDocumentStateId: mockStateId, ddexDocumentStateNameEn: 'Awaiting mapping', ddexDocumentStateNameEs: 'Requiere mapeo' }] }
    : [mockDocument], isLoading: false, isError: false, isFetching: false, refetch: jest.fn() };
} }));
jest.mock('../src/api/ddex', () => ({ ...jest.requireActual('../src/api/ddex'), listDdexDocuments: (...args: unknown[]) => mockList(...args) }));
jest.mock('../src/api/client', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../src/features/featureRegistry', () => ({ evaluateFeatureAccess: () => ({ state: 'allowed' }) }));
jest.mock('../src/analytics/AnalyticsProvider', () => ({ useAnalytics: () => ({ capture: jest.fn() }) }));
jest.mock('../src/providers/AuthProvider', () => ({ useAuth: () => ({ token: 'synthetic', roles: ['Admin'], modules: ['Catalog'] }) }));
jest.mock('../src/providers/UserSettingsProvider', () => ({ useUserSettings: () => ({ locale: 'en' }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {} }) }));
const Inbox = require('../app/ddex/index').default;

describe('Mobile DDEX inbox current contract', () => {
  beforeEach(() => { jest.clearAllMocks(); mockQueries.length = 0; });
  it('renders the canonical standard, version and server workflow label', () => {
    render(<Inbox />);
    expect(screen.getByText('ERN · 4.3.2 · Awaiting mapping')).toBeTruthy();
  });
  it('submits a governed workflow ID when a server-provided filter is selected', () => {
    render(<Inbox />);
    fireEvent.press(screen.getByRole('button', { name: 'Awaiting mapping' }));
    const selected = mockQueries.filter(query => query.queryKey[0] === 'ddex-documents').at(-1);
    selected?.queryFn();
    expect(mockList).toHaveBeenLastCalledWith(mockStateId);
  });
});
