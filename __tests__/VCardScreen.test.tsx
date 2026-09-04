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
  it('uses the saved identity without exposing an editable Party ID', async () => {
    render(<VCardScreen />);

    await waitFor(() => expect(screen.getByDisplayValue('Saved User')).toBeTruthy());
    expect(screen.queryByDisplayValue('42')).toBeNull();
    expect(screen.getByText('Tu identidad TDF se incluye automáticamente.')).toBeTruthy();
  });
});
