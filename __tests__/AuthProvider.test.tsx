import React, { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform } from 'react-native';

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
  const setLegacyItemMock = jest.mocked(AsyncStorage.setItem);
  const removeLegacyItemMock = jest.mocked(AsyncStorage.removeItem);

  const getSecureItemMock = jest.mocked(SecureStore.getItemAsync);
  const setSecureItemMock = jest.mocked(SecureStore.setItemAsync);
  const deleteSecureItemMock = jest.mocked(SecureStore.deleteItemAsync);

  const getMock = jest.mocked(get);
  const getAuthTokenMock = jest.mocked(getAuthToken);
  const setAuthTokenMock = jest.mocked(setAuthToken);
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();

    getAuthTokenMock.mockReturnValue(undefined);
    setAuthTokenMock.mockReset();
    getSecureItemMock.mockResolvedValue(null);
    setSecureItemMock.mockResolvedValue();
    deleteSecureItemMock.mockResolvedValue();
    getLegacyItemMock.mockResolvedValue(null);
    setLegacyItemMock.mockResolvedValue();
    removeLegacyItemMock.mockResolvedValue();
    getMock.mockResolvedValue({ partyId: 10 } as never);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOS });
  });

  it('hydrates and persists the legacy token directly on web without invoking secure storage', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    getLegacyItemMock.mockResolvedValueOnce('web-token');
    getMock.mockResolvedValueOnce({ partyId: 71 } as never);

    const { result } = renderAuthProvider();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getSecureItemMock).not.toHaveBeenCalled();
    expect(setSecureItemMock).not.toHaveBeenCalled();
    expect(setLegacyItemMock).toHaveBeenCalledWith('tdf-auth-token', 'Bearer web-token');
    expect(result.current.token).toBe('Bearer web-token');
    expect(result.current.partyId).toBe('71');
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

  it('clears a stored token when the authoritative session response is null', async () => {
    getSecureItemMock.mockResolvedValueOnce('Bearer revoked-token');
    getMock.mockResolvedValueOnce(null as never);
    const queryClient = createTestQueryClient();

    const { result } = renderAuthProvider(queryClient);

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.token).toBeNull());

    expect(result.current.partyId).toBeNull();
    expect(result.current.session).toBeNull();
    expect(setAuthTokenMock).toHaveBeenLastCalledWith(null);
    expect(deleteSecureItemMock).toHaveBeenCalledWith('tdf-auth-token');
    expect(removeLegacyItemMock).toHaveBeenCalledWith('tdf-auth-token');
    expect(result.current.sessionEpoch).toBeGreaterThan(0);
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

  it('advances cache occurrences for explicit auth transitions including the same token', async () => {
    const queryClient = createTestQueryClient();

    const { result } = renderAuthProvider(queryClient);

    await waitFor(() => expect(result.current.loading).toBe(false));
    const previousEpoch = result.current.sessionEpoch;

    act(() => {
      result.current.setToken('Bearer first-token');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith('Bearer first-token'));
    expect(result.current.sessionEpoch).toBeGreaterThan(previousEpoch);
    const firstEpoch = result.current.sessionEpoch;

    act(() => {
      result.current.setToken('Bearer first-token');
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith('Bearer first-token'));
    expect(result.current.sessionEpoch).toBeGreaterThan(firstEpoch);
    const secondEpoch = result.current.sessionEpoch;

    act(() => {
      result.current.clearToken();
    });

    await waitFor(() => expect(setAuthTokenMock).toHaveBeenLastCalledWith(null));
    expect(result.current.sessionEpoch).toBeGreaterThan(secondEpoch);
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
  it('does not restore the old account after logout secure deletion fails and the provider restarts', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    let currentApiToken: string | undefined;
    getAuthTokenMock.mockImplementation(() => currentApiToken);
    setAuthTokenMock.mockImplementation((value) => { currentApiToken = value ?? undefined; });
    getSecureItemMock.mockResolvedValue('Bearer retained-native-token');
    const stored = new Map<string, string>();
    getLegacyItemMock.mockImplementation(async (key) => stored.get(key) ?? null);
    setLegacyItemMock.mockImplementation(async (key, value) => { stored.set(key, value); });
    removeLegacyItemMock.mockImplementation(async (key) => { stored.delete(key); });
    deleteSecureItemMock.mockRejectedValue(new Error('synthetic secure delete failure'));
    getMock.mockResolvedValue({ partyId: 41 } as never);
    const first = renderAuthProvider();
    await waitFor(() => expect(first.result.current.partyId).toBe('41'));
    act(() => { first.result.current.clearToken(); });
    await waitFor(() => expect(first.result.current.token).toBeNull());
    await waitFor(() => expect(deleteSecureItemMock).toHaveBeenCalled());
    first.unmount();
    const restarted = renderAuthProvider();
    await waitFor(() => expect(restarted.result.current.loading).toBe(false));
    expect(restarted.result.current.token).toBeNull();
    expect(restarted.result.current.partyId).toBeNull();
  });

  it('does not restore stored credentials when the logout marker cannot be read', async () => {
    getSecureItemMock.mockResolvedValue('Bearer retained-native-token');
    getLegacyItemMock.mockImplementation(async (key) => {
      if (key === 'tdf-auth-logout-intent-v1') throw new Error('synthetic marker read failure');
      return null;
    });
    const { result } = renderAuthProvider();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.token).toBeNull();
    expect(result.current.partyId).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('reports an unpersisted logout and blocks restoration in this process when all writes fail', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    getSecureItemMock.mockResolvedValue('Bearer retained-native-token');
    const first = renderAuthProvider();
    await waitFor(() => expect(first.result.current.partyId).toBe('10'));
    setLegacyItemMock.mockRejectedValue(new Error('synthetic marker write failure'));
    deleteSecureItemMock.mockRejectedValue(new Error('synthetic secure delete failure'));
    removeLegacyItemMock.mockRejectedValue(new Error('synthetic legacy delete failure'));
    let durable = true;
    await act(async () => { durable = await first.result.current.clearTokenPersisted(); });
    expect(durable).toBe(false);
    first.unmount();
    const restarted = renderAuthProvider();
    await waitFor(() => expect(restarted.result.current.loading).toBe(false));
    expect(restarted.result.current.token).toBeNull();
    // Explicit new credentials recover; an unpersisted old account never wins.
    setLegacyItemMock.mockResolvedValue();
    setSecureItemMock.mockResolvedValue();
    removeLegacyItemMock.mockResolvedValue();
    act(() => { restarted.result.current.setToken('Bearer fresh-token', 20); });
    await waitFor(() => expect(removeLegacyItemMock).toHaveBeenCalledWith('tdf-auth-logout-intent-v1'));
    expect(restarted.result.current.partyId).toBe('20');
  });

  it('keeps a failed web credential deletion quarantined across remounts', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const stored = new Map([['tdf-auth-token', 'Bearer web-old-token']]);
    getLegacyItemMock.mockImplementation(async (key) => stored.get(key) ?? null);
    setLegacyItemMock.mockImplementation(async (key, value) => { stored.set(key, value); });
    removeLegacyItemMock.mockImplementation(async (key) => {
      if (key === 'tdf-auth-token') throw new Error('synthetic delete failure');
      stored.delete(key);
    });
    const first = renderAuthProvider();
    await waitFor(() => expect(first.result.current.partyId).toBe('10'));
    await act(async () => { expect(await first.result.current.clearTokenPersisted()).toBe(true); });
    expect(stored.get('tdf-auth-token')).toBe('Bearer web-old-token');
    first.unmount();
    const restarted = renderAuthProvider();
    await waitFor(() => expect(restarted.result.current.loading).toBe(false));
    expect(restarted.result.current.token).toBeNull();
  });

  it('keeps an unsuccessful credential replacement quarantined until a durable explicit login', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const stored = new Map([['tdf-auth-logout-intent-v1', 'blocked']]);
    let secure = 'Bearer old-token';
    let apiToken: string | undefined;
    getAuthTokenMock.mockImplementation(() => apiToken);
    setAuthTokenMock.mockImplementation((value) => { apiToken = value ?? undefined; });
    getSecureItemMock.mockImplementation(async () => secure);
    getLegacyItemMock.mockImplementation(async (key) => stored.get(key) ?? null);
    setLegacyItemMock.mockImplementation(async (key, value) => { stored.set(key, value); });
    removeLegacyItemMock.mockImplementation(async (key) => { stored.delete(key); });
    setSecureItemMock.mockRejectedValueOnce(new Error('synthetic credential write failure'));
    getMock.mockResolvedValue({ partyId: 20 } as never);
    const first = renderAuthProvider();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.token).toBeNull();
    act(() => { first.result.current.setToken('Bearer new-token', 20); });
    await waitFor(() => expect(setSecureItemMock).toHaveBeenCalled());
    expect(first.result.current.partyId).toBe('20');
    first.unmount();
    const restarted = renderAuthProvider();
    await waitFor(() => expect(restarted.result.current.loading).toBe(false));
    expect(restarted.result.current.token).toBeNull();
    expect(secure).toBe('Bearer old-token');
    setSecureItemMock.mockImplementation(async (_key, value) => { secure = value; });
    act(() => { restarted.result.current.setToken('Bearer new-token', 20); });
    await waitFor(() => expect(stored.has('tdf-auth-logout-intent-v1')).toBe(false));
    restarted.unmount();
    const durable = renderAuthProvider();
    await waitFor(() => expect(durable.result.current.partyId).toBe('20'));
    expect(durable.result.current.token).toBe('Bearer new-token');
  });

  it('orders an old token write before logout even when the provider remounts', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const stored = new Map<string, string>();
    const pending = createDeferred<void>();
    let secure: string | null = null;
    getSecureItemMock.mockImplementation(async () => secure);
    setSecureItemMock.mockImplementation(async (_key, value) => { await pending.promise; secure = value; });
    deleteSecureItemMock.mockImplementation(async () => { secure = null; });
    getLegacyItemMock.mockImplementation(async (key) => stored.get(key) ?? null);
    setLegacyItemMock.mockImplementation(async (key, value) => { stored.set(key, value); });
    removeLegacyItemMock.mockImplementation(async (key) => { stored.delete(key); });
    const first = renderAuthProvider();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    act(() => { first.result.current.setToken('Bearer queued-token', 10); });
    await waitFor(() => expect(setSecureItemMock).toHaveBeenCalled());
    let logout: Promise<boolean> | undefined;
    act(() => { logout = first.result.current.clearTokenPersisted(); });
    first.unmount();
    const restarted = renderAuthProvider();
    expect(restarted.result.current.loading).toBe(true);
    await act(async () => { pending.resolve(); expect(await logout).toBe(true); });
    await waitFor(() => expect(restarted.result.current.loading).toBe(false));
    expect(restarted.result.current.token).toBeNull();
    expect(secure).toBeNull();
  });

  it('treats an unrecognized nonempty logout marker as a restoration barrier', async () => {
    getSecureItemMock.mockResolvedValue('Bearer retained-native-token');
    getLegacyItemMock.mockImplementation(async (key) => key === 'tdf-auth-logout-intent-v1' ? 'truncated-marker' : null);
    const { result } = renderAuthProvider();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.token).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

});
