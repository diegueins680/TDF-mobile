import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';

import VCardScreen from '../app/(tabs)/vcard';

jest.mock('react-native-qrcode-svg', () => () => null);
jest.mock('../src/api/socialV2', () => ({
  ...jest.requireActual('../src/api/socialV2'),
  resolveSocialMode: jest.fn(async () => ({ mode: 'legacy' })),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({
    token: 'Bearer demo',
    partyId: '7',
    session: { displayName: 'Session User' },
  })),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: jest.fn(() => ({ partyId: '42', displayName: 'Saved User' })),
}));

describe('VCard screen', () => {
  it('uses only authenticated identity without exposing an editable Party ID', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    render(<QueryClientProvider client={client}><VCardScreen /></QueryClientProvider>);

    await waitFor(() => expect(screen.getByDisplayValue('Session User')).toBeTruthy());
    expect(screen.queryByDisplayValue('Saved User')).toBeNull();
    expect(screen.queryByDisplayValue('42')).toBeNull();
    expect(screen.getByText('Tu identidad TDF se incluye automáticamente.')).toBeTruthy();
  });
});
