import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

const mockItem = {
  id: '9ac1139b-d570-40e1-a80d-5a0c1c2bb5e1',
  organizationId: '00000000-0000-4000-8000-000000000001',
  branchId: '00000000-0000-4000-8000-000000000002',
  sourceSystem: 'tdf-hq', sourceChannel: 'web', entityType: 'course_registration', entityId: '42',
  uncorrelated: false, correlationKey: 'registration:42',
  titleEs: 'Registro nuevo de curso', titleEn: 'New course registration',
  descriptionEs: 'Requiere atención', descriptionEn: 'Needs attention',
  status: 'new', priority: 'high', recommendedPriority: 'high', severity: 'warning', seen: true,
  firstSeenBy: 1, firstSeenAt: '2026-08-11T13:00:00Z', assigneePartyId: null, responsibleTeam: 'reception',
  customerPartyId: 42, serviceKey: 'course', amountMinor: null, currency: 'USD', paymentState: null,
  createdAt: '2026-08-11T13:00:00Z', updatedAt: '2026-08-11T13:00:00Z', dueAt: '2026-08-11T14:00:00Z',
  snoozedUntil: null, waitingReason: null, waitingExternalDependency: false, resumeAt: null,
  resolvedAt: null, archivedAt: null, slaState: 'on_track', version: 1, metadata: {},
};

jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: jest.fn(() => ({
    data: { pages: [{ items: [mockItem], nextCursor: null, hasMore: false }] },
    isLoading: false, isError: false, isRefetching: false, isFetchingNextPage: false,
    hasNextPage: false, refetch: jest.fn(), fetchNextPage: jest.fn(),
  })),
  useQuery: jest.fn(() => ({ data: undefined, isLoading: false, isError: false })),
  useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ setParams: jest.fn(), push: jest.fn() }),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({ partyId: '7', token: 'Bearer test' }),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({ locale: 'es', timezone: 'America/Guayaquil' }),
}));

jest.mock('../src/theme/ThemeProvider', () => ({
  useAppTheme: () => ({ colors: {
    canvas: '#fff', surfaceRaised: '#fff', surface: '#fff', selected: '#eee',
    textPrimary: '#111', textSecondary: '#555', actionPrimary: '#6200ee', actionPrimaryContrast: '#fff',
    border: '#999', borderSubtle: '#ddd', danger: '#b91c1c', dangerBorder: '#b91c1c',
  } }),
}));

const OperationsScreen = require('../app/operations').default;

describe('Operations mobile screen', () => {
  it('renders a persisted, priority-aware staff queue without demo fallback data', () => {
    render(<OperationsScreen />);
    expect(screen.getByText('Centro de operaciones')).toBeTruthy();
    expect(screen.getByText('Registro nuevo de curso')).toBeTruthy();
    expect(screen.getAllByText('Nuevo').length).toBeGreaterThan(0);
    expect(screen.getByText('course_registration · web')).toBeTruthy();
  });
});
