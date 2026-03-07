import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { get, getAuthToken, setAuthToken } from '../src/api/client';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../src/api/client', () => ({
  get: jest.fn(),
  getAuthToken: jest.fn(),
  normalizeAuthToken: jest.fn((value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;

    if (/^bearer\b/i.test(trimmed)) {
      const credentials = trimmed.replace(/^bearer\b/i, '').trim();
      return credentials ? `Bearer ${credentials}` : undefined;
    }

    return `Bearer ${trimmed}`;
  }),
  setAuthToken: jest.fn(),
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

type AuthSnapshot = ReturnType<typeof useAuth>;

function ContextProbe({ onChange }: { onChange: (value: AuthSnapshot) => void }) {
  const value = useAuth();
  useEffect(() => {
    onChange(value);
  }, [value, onChange]);
  return null;
}

describe('AuthProvider', () => {
  const getItemMock = jest.mocked(AsyncStorage.getItem);
  const setItemMock = jest.mocked(AsyncStorage.setItem);
  const removeItemMock = jest.mocked(AsyncStorage.removeItem);

  const getMock = jest.mocked(get);
  const getAuthTokenMock = jest.mocked(getAuthToken);
  const setAuthTokenMock = jest.mocked(setAuthToken);

  let latest: AuthSnapshot | null = null;

  const onProbeChange = (value: AuthSnapshot) => {
    latest = value;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    latest = null;

    getAuthTokenMock.mockReturnValue(undefined);
    getItemMock.mockResolvedValue(null);
    setItemMock.mockResolvedValue();
    removeItemMock.mockResolvedValue();
    getMock.mockResolvedValue({ id: 10 } as never);
  });

  it('normalizes blank tokens to null and clears persisted storage', async () => {
    render(
      <AuthProvider>
        <ContextProbe onChange={onProbeChange} />
      </AuthProvider>,
    );

    await waitFor(() => expect(latest?.loading).toBe(false));

    act(() => {
      latest?.setToken('   ');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith(null));

    expect(setItemMock).not.toHaveBeenCalled();
    expect(removeItemMock).toHaveBeenCalledWith('tdf-auth-token');
    expect(latest?.token).toBeNull();
    expect(latest?.partyId).toBeNull();
  });

  it('normalizes raw tokens into bearer format before persisting them', async () => {
    render(
      <AuthProvider>
        <ContextProbe onChange={onProbeChange} />
      </AuthProvider>,
    );

    await waitFor(() => expect(latest?.loading).toBe(false));

    act(() => {
      latest?.setToken('  demo-token  ');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith('Bearer demo-token'));

    expect(setItemMock).toHaveBeenLastCalledWith('tdf-auth-token', 'Bearer demo-token');
    expect(latest?.token).toBe('Bearer demo-token');
  });

  it('does not let slow storage bootstrap overwrite a newer manual token', async () => {
    const pendingStoredToken = createDeferred<string | null>();
    getItemMock.mockReturnValueOnce(pendingStoredToken.promise);

    render(
      <AuthProvider>
        <ContextProbe onChange={onProbeChange} />
      </AuthProvider>,
    );

    await waitFor(() => expect(latest?.setToken).toBeDefined());

    act(() => {
      latest?.setToken('fresh-token');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenCalledWith('Bearer fresh-token'));
    await waitFor(() => expect(latest?.token).toBe('Bearer fresh-token'));

    await act(async () => {
      pendingStoredToken.resolve('Bearer stale-token');
      await pendingStoredToken.promise;
    });

    await waitFor(() => expect(latest?.loading).toBe(false));

    expect(setAuthTokenMock).not.toHaveBeenCalledWith('Bearer stale-token');
    expect(setItemMock).toHaveBeenLastCalledWith('tdf-auth-token', 'Bearer fresh-token');
    expect(latest?.token).toBe('Bearer fresh-token');
  });

  it('ignores stale party profile lookups after token is cleared', async () => {
    render(
      <AuthProvider>
        <ContextProbe onChange={onProbeChange} />
      </AuthProvider>,
    );

    await waitFor(() => expect(latest?.loading).toBe(false));

    const pendingProfile = createDeferred<{ id: number }>();
    getMock.mockReturnValueOnce(pendingProfile.promise as never);

    act(() => {
      latest?.setToken('Bearer abc');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenCalledWith('Bearer abc'));

    act(() => {
      latest?.clearToken();
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith(null));

    await act(async () => {
      pendingProfile.resolve({ id: 77 });
      await pendingProfile.promise;
    });

    await waitFor(() => expect(latest?.partyId).toBeNull());
    expect(latest?.token).toBeNull();
  });

  it('loads and trims stored token before resolving current party id', async () => {
    getItemMock.mockResolvedValueOnce('   Bearer saved-token   ');
    getMock.mockResolvedValueOnce({ id: 42 } as never);

    render(
      <AuthProvider>
        <ContextProbe onChange={onProbeChange} />
      </AuthProvider>,
    );

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenCalledWith('Bearer saved-token'));
    await waitFor(() => expect(latest?.loading).toBe(false));

    expect(setItemMock).toHaveBeenCalledWith('tdf-auth-token', 'Bearer saved-token');
    expect(latest?.token).toBe('Bearer saved-token');
    expect(latest?.partyId).toBe('42');
  });

  it('recovers when token storage bootstrap fails', async () => {
    getItemMock.mockRejectedValueOnce(new Error('storage unavailable'));

    render(
      <AuthProvider>
        <ContextProbe onChange={onProbeChange} />
      </AuthProvider>,
    );

    await waitFor(() => expect(latest?.loading).toBe(false));

    expect(setAuthTokenMock).toHaveBeenCalledWith(null);
    expect(latest?.token).toBeNull();
    expect(latest?.partyId).toBeNull();
  });

  it('keeps auth state updates even when persisting token fails', async () => {
    setItemMock.mockRejectedValueOnce(new Error('disk full'));
    removeItemMock.mockRejectedValueOnce(new Error('disk full'));

    render(
      <AuthProvider>
        <ContextProbe onChange={onProbeChange} />
      </AuthProvider>,
    );

    await waitFor(() => expect(latest?.loading).toBe(false));

    act(() => {
      latest?.setToken('Bearer volatile-token');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith('Bearer volatile-token'));
    await waitFor(() => expect(latest?.token).toBe('Bearer volatile-token'));

    act(() => {
      latest?.clearToken();
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith(null));
    await waitFor(() => expect(latest?.token).toBeNull());
  });
});
