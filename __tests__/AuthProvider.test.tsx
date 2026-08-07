import React, { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { get, getAuthToken, setAuthToken } from '../src/api/client';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
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

jest.setTimeout(10_000);

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

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

function createAuthWrapper(queryClient: QueryClient) {
  return function AuthWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

function renderAuthProvider(queryClient = createTestQueryClient()) {
  return {
    queryClient,
    ...renderHook(() => useAuth(), {
      wrapper: createAuthWrapper(queryClient),
    }),
  };
}

describe('AuthProvider', () => {
  const getLegacyItemMock = jest.mocked(AsyncStorage.getItem);
  const removeLegacyItemMock = jest.mocked(AsyncStorage.removeItem);

  const getSecureItemMock = jest.mocked(SecureStore.getItemAsync);
  const setSecureItemMock = jest.mocked(SecureStore.setItemAsync);
  const deleteSecureItemMock = jest.mocked(SecureStore.deleteItemAsync);

  const getMock = jest.mocked(get);
  const getAuthTokenMock = jest.mocked(getAuthToken);
  const setAuthTokenMock = jest.mocked(setAuthToken);

  beforeEach(() => {
    jest.clearAllMocks();

    getAuthTokenMock.mockReturnValue(undefined);
    getSecureItemMock.mockResolvedValue(null);
    setSecureItemMock.mockResolvedValue();
    deleteSecureItemMock.mockResolvedValue();
    getLegacyItemMock.mockResolvedValue(null);
    removeLegacyItemMock.mockResolvedValue();
    getMock.mockResolvedValue({ partyId: 10 } as never);
  });

  it('normalizes blank tokens to null and clears persisted storage', async () => {
    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setToken('   ');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith(null));

    expect(setSecureItemMock).not.toHaveBeenCalled();
    expect(deleteSecureItemMock).toHaveBeenCalledWith('tdf-auth-token');
    expect(removeLegacyItemMock).toHaveBeenCalledWith('tdf-auth-token');
    expect(result.current.token).toBeNull();
    expect(result.current.partyId).toBeNull();
  });

  it('normalizes raw tokens into bearer format before persisting them', async () => {
    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setToken('  demo-token  ');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith('Bearer demo-token'));

    expect(setSecureItemMock).toHaveBeenLastCalledWith('tdf-auth-token', 'Bearer demo-token');
    expect(removeLegacyItemMock).toHaveBeenCalledWith('tdf-auth-token');
    expect(result.current.token).toBe('Bearer demo-token');
  });

  it('does not let slow secure-store bootstrap overwrite a newer manual token', async () => {
    const pendingStoredToken = createDeferred<string | null>();
    getSecureItemMock.mockReturnValueOnce(pendingStoredToken.promise);

    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.setToken).toBeDefined());

    act(() => {
      result.current.setToken('fresh-token');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenCalledWith('Bearer fresh-token'));
    await waitFor(() => expect(result.current.token).toBe('Bearer fresh-token'));

    await act(async () => {
      pendingStoredToken.resolve('Bearer stale-token');
      await pendingStoredToken.promise;
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(setAuthTokenMock).not.toHaveBeenCalledWith('Bearer stale-token');
    expect(setSecureItemMock).toHaveBeenLastCalledWith('tdf-auth-token', 'Bearer fresh-token');
    expect(result.current.token).toBe('Bearer fresh-token');
  });

  it('ignores stale party profile lookups after token is cleared', async () => {
    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    const pendingProfile = createDeferred<{ partyId: number }>();
    getMock.mockReturnValueOnce(pendingProfile.promise as never);

    act(() => {
      result.current.setToken('Bearer abc');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenCalledWith('Bearer abc'));

    act(() => {
      result.current.clearToken();
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith(null));

    await act(async () => {
      pendingProfile.resolve({ partyId: 77 });
      await pendingProfile.promise;
    });

    await waitFor(() => expect(result.current.partyId).toBeNull());
    expect(result.current.token).toBeNull();
  });

  it('loads and trims the secure token before resolving current party id', async () => {
    getSecureItemMock.mockResolvedValueOnce('   Bearer saved-token   ');
    getMock.mockResolvedValueOnce({ partyId: 42 } as never);

    const { result } = renderAuthProvider();

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenCalledWith('Bearer saved-token'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(setSecureItemMock).toHaveBeenCalledWith('tdf-auth-token', 'Bearer saved-token');
    expect(result.current.token).toBe('Bearer saved-token');
    expect(result.current.partyId).toBe('42');
  });

  it('hydrates normalized roles, modules, and feature flags from the authoritative session endpoint', async () => {
    getSecureItemMock.mockResolvedValueOnce('Bearer saved-token');
    getMock.mockResolvedValueOnce({
      partyId: 42,
      roles: ['ReadOnly', ' readonly ', 'Customer'],
      modules: ['Catalog', ' CRM ', 'catalog'],
      featureFlags: ['EVENT_DISCOVERY_ENABLED', ' event_discovery_enabled '],
    } as never);

    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.roles).toEqual(['readonly', 'customer']);
    expect(result.current.modules).toEqual(['catalog', 'crm']);
    expect(result.current.featureFlags).toEqual(['event_discovery_enabled']);
    expect(result.current.session?.partyId).toBe('42');
  });

  it('migrates a legacy async-storage token into secure storage', async () => {
    getLegacyItemMock.mockResolvedValueOnce('legacy-token');
    getMock.mockResolvedValueOnce({ partyId: 88 } as never);

    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(setAuthTokenMock).toHaveBeenCalledWith('Bearer legacy-token');
    expect(setSecureItemMock).toHaveBeenCalledWith('tdf-auth-token', 'Bearer legacy-token');
    expect(removeLegacyItemMock).toHaveBeenCalledWith('tdf-auth-token');
    expect(result.current.partyId).toBe('88');
  });

  it('preserves an already loaded auth token when persisted storage is empty', async () => {
    getAuthTokenMock.mockReturnValue('Bearer in-memory-token');
    getMock.mockResolvedValueOnce({ partyId: 55 } as never);

    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(setAuthTokenMock).toHaveBeenCalledWith('Bearer in-memory-token');
    expect(setSecureItemMock).toHaveBeenCalledWith('tdf-auth-token', 'Bearer in-memory-token');
    expect(result.current.token).toBe('Bearer in-memory-token');
    expect(result.current.partyId).toBe('55');
  });

  it('falls back to a null session when secure storage is unavailable', async () => {
    getSecureItemMock.mockRejectedValueOnce(new Error('secure store unavailable'));

    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(setAuthTokenMock).toHaveBeenCalledWith(null);
    expect(result.current.token).toBeNull();
    expect(result.current.partyId).toBeNull();
  });

  it('keeps an in-memory auth token when secure storage is unavailable', async () => {
    getAuthTokenMock.mockReturnValue('Bearer cached-token');
    getSecureItemMock.mockRejectedValueOnce(new Error('secure store unavailable'));
    getMock.mockResolvedValueOnce({ partyId: 99 } as never);

    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(setAuthTokenMock).toHaveBeenCalledWith('Bearer cached-token');
    expect(result.current.token).toBe('Bearer cached-token');
    expect(result.current.partyId).toBe('99');
  });

  it('keeps auth state updates even when secure persistence fails', async () => {
    setSecureItemMock.mockRejectedValueOnce(new Error('secure store full'));
    deleteSecureItemMock.mockRejectedValueOnce(new Error('secure store full'));
    removeLegacyItemMock.mockRejectedValueOnce(new Error('legacy cleanup failed'));

    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setToken('Bearer volatile-token');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith('Bearer volatile-token'));
    await waitFor(() => expect(result.current.token).toBe('Bearer volatile-token'));

    act(() => {
      result.current.clearToken();
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith(null));
    await waitFor(() => expect(result.current.token).toBeNull());
  });

  it('clears stale party id immediately when switching to a different token', async () => {
    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    getMock.mockResolvedValueOnce({ partyId: 11 } as never);

    act(() => {
      result.current.setToken('Bearer first-token');
    });

    await waitFor(() => expect(result.current.partyId).toBe('11'));

    const pendingProfile = createDeferred<{ partyId: number }>();
    getMock.mockReturnValueOnce(pendingProfile.promise as never);

    act(() => {
      result.current.setToken('Bearer second-token');
    });

    await waitFor(() => expect(result.current.partyId).toBeNull());

    await act(async () => {
      pendingProfile.resolve({ partyId: 22 });
      await pendingProfile.promise;
    });

    await waitFor(() => expect(result.current.partyId).toBe('22'));
  });

  it('clears cached queries when the auth token changes', async () => {
    const queryClient = createTestQueryClient();
    const clearSpy = jest.spyOn(queryClient, 'clear');

    const { result } = renderAuthProvider(queryClient);

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setToken('Bearer first-token');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith('Bearer first-token'));
    expect(clearSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setToken('Bearer first-token');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith('Bearer first-token'));
    expect(clearSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.clearToken();
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith(null));
    expect(clearSpy).toHaveBeenCalledTimes(2);
  });

  it('preserves a known party id passed with a fresh token without waiting for hydration', async () => {
    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setToken('Bearer seeded-token', 33);
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith('Bearer seeded-token'));

    expect(result.current.partyId).toBe('33');
    expect(getMock).not.toHaveBeenCalled();
  });
});
