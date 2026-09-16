import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockMutate = jest.fn();
const mockReplace = jest.fn();
const mockRedirect = jest.fn((_props: unknown) => null);
let mockSearchParams = { feature: 'events.manage', action: 'create' };
const mockInvalidateQueries = jest.fn(async () => undefined);
const mockCapture = jest.fn();
type FirstValueCompletionArgs = [
  string | null | undefined,
  string,
  () => boolean,
  { capture: typeof mockCapture },
];
const mockRecordFirstValueCompletion = jest.fn<Promise<boolean>, FirstValueCompletionArgs>(async () => true);
const mockMutationOptions: Array<{
  onSuccess?: (result: unknown, variables: { ownerPartyId: string }) => Promise<void>;
}> = [];

const feature = {
  id: 'events.manage',
  technical: false,
  accessRequestEligible: true,
  description: { es: 'Crea tu perfil', en: 'Create your profile' },
};

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((options) => {
    mockMutationOptions.push(options);
    return { mutate: mockMutate, isPending: false, isError: false };
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockSearchParams,
  Redirect: (props: unknown) => mockRedirect(props),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({
    token: 'Bearer demo',
    partyId: '42',
    roles: ['Customer'],
    modules: [],
  }),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({ locale: 'es' }),
}));

jest.mock('../src/theme/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      canvas: '#fff',
      textPrimary: '#111',
      textSecondary: '#555',
      surface: '#fff',
      border: '#ccc',
      danger: '#b00020',
      actionPrimary: '#222',
      actionPrimaryContrast: '#fff',
    },
  }),
}));

jest.mock('../src/features/generatedFeatureRegistry', () => ({
  mobileFeatureRegistry: [],
}));

jest.mock('../src/features/featureRegistry', () => ({
  getFeatureById: () => feature,
  evaluateFeatureAccess: () => ({
    state: 'locked',
    missingRoles: ['manager'],
    missingModules: [],
  }),
  featureLabel: () => 'Gestionar eventos',
  resolveMobileDestination: () => '/createEvent',
}));

jest.mock('../src/api/accessRequests', () => ({
  submitAccessRequest: jest.fn(),
}));

jest.mock('../src/analytics/AnalyticsProvider', () => ({
  useAnalytics: () => ({ capture: mockCapture }),
}));

jest.mock('../src/lib/firstValueCompletion', () => ({
  recordFirstValueCompletion: (...args: FirstValueCompletionArgs) => mockRecordFirstValueCompletion(...args),
}));

const NewAccessRequestScreen = require('../app/access-requests/new').default;

describe('access request first-value ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutationOptions.length = 0;
    mockSearchParams = { feature: 'events.manage', action: 'create' };
  });

  it('redirects legacy artist requests to immediate creation', () => {
    mockSearchParams = { feature: 'artist.onboarding', action: 'create' };
    render(<NewAccessRequestScreen />);
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/createArtistProfile' });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('carries the initiating Party through submission and completion', async () => {
    render(<NewAccessRequestScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(mockMutate).toHaveBeenCalledWith({ ownerPartyId: '42' });

    await act(async () => {
      await mockMutationOptions[0].onSuccess?.(
        { featureId: 'events.manage', action: 'create' },
        { ownerPartyId: '42' },
      );
    });

    expect(mockRecordFirstValueCompletion).toHaveBeenCalledWith(
      '42',
      'access_requested',
      expect.any(Function),
      expect.objectContaining({ capture: mockCapture }),
    );
    const stillOwnsParty = mockRecordFirstValueCompletion.mock.calls[0][2] as () => boolean;
    expect(stillOwnsParty()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/access-requests');
  });
});
