import React, { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  UserSettingsProvider,
  parseUserSettings,
  useUserSettings,
} from '../src/providers/UserSettingsProvider';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

function UserSettingsWrapper({ children }: PropsWithChildren) {
  return <UserSettingsProvider>{children}</UserSettingsProvider>;
}

function renderUserSettingsProvider() {
  return renderHook(() => useUserSettings(), {
    wrapper: UserSettingsWrapper,
  });
}

function expectLastStoredIdentity(partyId: string, displayName: string) {
  const lastCall = jest.mocked(AsyncStorage.setItem).mock.calls.at(-1);
  expect(lastCall?.[0]).toBe('tdf-user-settings');
  const stored = JSON.parse(lastCall?.[1] ?? '{}') as Record<string, unknown>;
  expect(stored).toMatchObject({ partyId, displayName });
  expect(stored.locale).toEqual(expect.any(String));
  expect(stored.currency).toEqual(expect.any(String));
  expect(stored.timezone).toEqual(expect.any(String));
}

describe('UserSettingsProvider', () => {
  const getItemMock = jest.mocked(AsyncStorage.getItem);
  const setItemMock = jest.mocked(AsyncStorage.setItem);
  const removeItemMock = jest.mocked(AsyncStorage.removeItem);

  beforeEach(() => {
    jest.clearAllMocks();

    getItemMock.mockResolvedValue(null);
    setItemMock.mockResolvedValue();
    removeItemMock.mockResolvedValue();
  });

  it('restores canonical locale and currency UUIDs from offline storage', () => {
    const localeId = '11111111-1111-4111-8111-111111111111';
    const currencyId = '22222222-2222-4222-8222-222222222222';
    const parsed = parseUserSettings(JSON.stringify({
      localeId,
      locale: 'es',
      currencyId,
      currency: 'USD',
      timezone: 'America/Guayaquil',
    }), ['es', 'en'], ['USD']);

    expect(parsed).toMatchObject({ localeId, locale: 'es', currencyId, currency: 'USD' });
  });

  it('withholds malformed stored identifiers for snapshot reconciliation', () => {
    const parsed = parseUserSettings(JSON.stringify({
      localeId: 'es',
      locale: 'es',
      currencyId: 'USD',
      currency: 'USD',
    }), ['es', 'en'], ['USD']);

    expect(parsed).toMatchObject({ localeId: '', locale: 'es', currencyId: '', currency: 'USD' });
  });

  it('trims stored identity values and drops blank entries', async () => {
    getItemMock.mockResolvedValueOnce(JSON.stringify({
      partyId: '  0042  ',
      displayName: '   ',
    }));

    const { result } = renderUserSettingsProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.partyId).toBe('42');
    expect(result.current.displayName).toBeNull();
  });

  it('drops invalid stored party ids instead of persisting arbitrary text', async () => {
    getItemMock.mockResolvedValueOnce(JSON.stringify({
      partyId: 'abc',
      displayName: 'Valid Name',
    }));

    const { result } = renderUserSettingsProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.partyId).toBeNull();
    expect(result.current.displayName).toBe('Valid Name');
  });

  it('does not let slow storage bootstrap overwrite a newer identity', async () => {
    const pendingStoredSettings = createDeferred<string | null>();
    getItemMock.mockReturnValueOnce(pendingStoredSettings.promise);

    const { result } = renderUserSettingsProvider();

    await waitFor(() => expect(result.current.setIdentity).toBeDefined());

    act(() => {
      result.current.setIdentity(' 123 ', '  New Name  ');
    });

    await waitFor(() => expect(result.current.partyId).toBe('123'));
    expect(result.current.displayName).toBe('New Name');

    await act(async () => {
      pendingStoredSettings.resolve(JSON.stringify({
        partyId: '999',
        displayName: 'Old Name',
      }));
      await pendingStoredSettings.promise;
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.partyId).toBe('123');
    expect(result.current.displayName).toBe('New Name');
    expectLastStoredIdentity('123', 'New Name');
  });

  it('keeps in-memory defaults when reading storage fails', async () => {
    getItemMock.mockRejectedValueOnce(new Error('storage unavailable'));

    const { result } = renderUserSettingsProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.partyId).toBeNull();
    expect(result.current.displayName).toBeNull();
    expect(removeItemMock).not.toHaveBeenCalled();
  });

  it('preserves the current display name when only the party id is updated', async () => {
    getItemMock.mockResolvedValueOnce(JSON.stringify({
      partyId: '123',
      displayName: 'Existing Name',
    }));

    const { result } = renderUserSettingsProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setIdentity('456');
    });

    await waitFor(() => expectLastStoredIdentity('456', 'Existing Name'));

    expect(result.current.partyId).toBe('456');
    expect(result.current.displayName).toBe('Existing Name');
  });

  it('preserves the latest display name across back-to-back identity updates', async () => {
    const { result } = renderUserSettingsProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setIdentity('123', 'Fresh Name');
      result.current.setIdentity('456');
    });

    await waitFor(() => expectLastStoredIdentity('456', 'Fresh Name'));

    expect(result.current.partyId).toBe('456');
    expect(result.current.displayName).toBe('Fresh Name');
  });
});
