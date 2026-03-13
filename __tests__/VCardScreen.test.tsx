import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import VCardScreen from '../app/(tabs)/vcard';

jest.mock('react-native-qrcode-svg', () => () => null);

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({ token: 'Bearer demo', partyId: null })),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: jest.fn(() => ({ partyId: '42', displayName: 'Saved User' })),
}));

describe('VCard screen', () => {
  it('hydrates the saved identity into the shared card', async () => {
    render(<VCardScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('Saved User')).toBeTruthy());
    expect(screen.getByDisplayValue('42')).toBeTruthy();
  });
});
