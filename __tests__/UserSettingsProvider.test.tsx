import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { UserSettingsProvider, useUserSettings } from '../src/providers/UserSettingsProvider';

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

type UserSettingsSnapshot = ReturnType<typeof useUserSettings>;

function ContextProbe({ onChange }: { onChange: (value: UserSettingsSnapshot) => void }) {
  const value = useUserSettings();

  useEffect(() => {
    onChange(value);
  }, [onChange, value]);

  return null;
}

describe('UserSettingsProvider', () => {
  const getItemMock = jest.mocked(AsyncStorage.getItem);
  const setItemMock = jest.mocked(AsyncStorage.setItem);
  const removeItemMock = jest.mocked(AsyncStorage.removeItem);

  let latest: UserSettingsSnapshot | null = null;

  const onProbeChange = (value: UserSettingsSnapshot) => {
    latest = value;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    latest = null;

    getItemMock.mockResolvedValue(null);
    setItemMock.mockResolvedValue();
    removeItemMock.mockResolvedValue();
  });

  it('trims stored identity values and drops blank entries', async () => {
    getItemMock.mockResolvedValueOnce(JSON.stringify({
      partyId: '  42  ',
      displayName: '   ',
    }));

    render(
      <UserSettingsProvider>
        <ContextProbe onChange={onProbeChange} />
      </UserSettingsProvider>,
    );

    await waitFor(() => expect(latest?.loading).toBe(false));

    expect(latest?.partyId).toBe('42');
    expect(latest?.displayName).toBeNull();
  });

  it('does not let slow storage bootstrap overwrite a newer identity', async () => {
    const pendingStoredSettings = createDeferred<string | null>();
    getItemMock.mockReturnValueOnce(pendingStoredSettings.promise);

    render(
      <UserSettingsProvider>
        <ContextProbe onChange={onProbeChange} />
      </UserSettingsProvider>,
    );

    await waitFor(() => expect(latest?.setIdentity).toBeDefined());

    act(() => {
      latest?.setIdentity(' 123 ', '  New Name  ');
    });

    await waitFor(() => expect(latest?.partyId).toBe('123'));
    expect(latest?.displayName).toBe('New Name');

    await act(async () => {
      pendingStoredSettings.resolve(JSON.stringify({
        partyId: '999',
        displayName: 'Old Name',
      }));
      await pendingStoredSettings.promise;
    });

    await waitFor(() => expect(latest?.loading).toBe(false));

    expect(latest?.partyId).toBe('123');
    expect(latest?.displayName).toBe('New Name');
    expect(setItemMock).toHaveBeenCalledWith(
      'tdf-user-settings',
      JSON.stringify({ partyId: '123', displayName: 'New Name' }),
    );
  });

  it('keeps in-memory defaults when reading storage fails', async () => {
    getItemMock.mockRejectedValueOnce(new Error('storage unavailable'));

    render(
      <UserSettingsProvider>
        <ContextProbe onChange={onProbeChange} />
      </UserSettingsProvider>,
    );

    await waitFor(() => expect(latest?.loading).toBe(false));

    expect(latest?.partyId).toBeNull();
    expect(latest?.displayName).toBeNull();
    expect(removeItemMock).not.toHaveBeenCalled();
  });

  it('preserves the current display name when only the party id is updated', async () => {
    getItemMock.mockResolvedValueOnce(JSON.stringify({
      partyId: '123',
      displayName: 'Existing Name',
    }));

    render(
      <UserSettingsProvider>
        <ContextProbe onChange={onProbeChange} />
      </UserSettingsProvider>,
    );

    await waitFor(() => expect(latest?.loading).toBe(false));

    act(() => {
      latest?.setIdentity('456');
    });

    await waitFor(() =>
      expect(setItemMock).toHaveBeenLastCalledWith(
        'tdf-user-settings',
        JSON.stringify({ partyId: '456', displayName: 'Existing Name' }),
      )
    );

    expect(latest?.partyId).toBe('456');
    expect(latest?.displayName).toBe('Existing Name');
  });
});
