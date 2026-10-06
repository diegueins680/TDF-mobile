import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { AuthQueryProviders } from '../src/providers/AuthQueryProviders';
import { useAuth } from '../src/providers/AuthProvider';
import Screen from '../app/(tabs)/more';
import { get, put, post } from '../src/api/client';
import type { NavigationPreference } from '../src/api/navigationPreferences';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
jest.mock('../src/api/client', () => ({
  get: jest.fn(), put: jest.fn(), post: jest.fn(), getAuthToken: jest.fn(), setAuthToken: jest.fn(),
  normalizeAuthToken: (value?: string | null) => value?.trim() ? `Bearer ${value.replace(/^Bearer /, '').trim()}` : undefined,
}));
jest.mock('../src/analytics/AnalyticsProvider', () => ({ useAnalytics: () => ({ capture: jest.fn() }) }));
jest.mock('../src/providers/UserSettingsProvider', () => ({ useUserSettings: () => ({ locale: 'en' }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

jest.setTimeout(30_000);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

async function harness() {
  let auth!: ReturnType<typeof useAuth>;
  let client!: QueryClient;
  let show!: (visible: boolean) => void;
  const clients = new Set<QueryClient>();
  const reads: string[] = [];
  jest.mocked(get).mockImplementation(async (path) => {
    if (path !== '/navigation/preferences') throw new Error(`Unexpected GET ${path}`);
    reads.push(auth.partyId!);
    return [] as never;
  });
  function Consumer() {
    auth = useAuth();
    client = useQueryClient();
    clients.add(client);
    // Avoid retained test timers from the intentionally orphaned old mutation.
    // Production staleTime/retry defaults stay intact.
    client.setDefaultOptions({
      queries: { ...client.getDefaultOptions().queries, gcTime: Infinity },
      mutations: { ...client.getDefaultOptions().mutations, gcTime: Infinity },
    });
    const [visible, setVisible] = React.useState(true);
    show = setVisible;
    return visible ? <Screen /> : null;
  }
  const view = render(<AuthQueryProviders><Consumer /></AuthQueryProviders>);
  // React Native Testing Library must perform its initial synchronous render
  // before an asynchronous act scope. Then flush provider bootstrap promises
  // before starting waitFor's short observation clock on a cold screen.
  await act(async () => { await Promise.resolve(); });
  return {
    view, reads, get auth() { return auth; }, get client() { return client; },
    show: (visible: boolean) => show(visible),
    close: () => { view.unmount(); clients.forEach((entry) => entry.clear()); },
  };
}

beforeEach(() => { jest.clearAllMocks(); });

it.each(['favorite', 'visit'] as const)('isolates a late %s response after actual screen unmount, logout and another account login', async (kind) => {
  const pending = deferred<NavigationPreference>();
  const saved: NavigationPreference = {
    featureId: 'home', favorite: true, pinned: false, pinOrder: null,
    lastVisitedAt: '2026-10-05T12:00:00Z', useCount: 73, updatedAt: '2026-10-05T12:00:01Z',
  };
  jest.mocked(put).mockReturnValue(pending.promise as never);
  jest.mocked(post).mockReturnValue(pending.promise as never);
  const h = await harness();
  await waitFor(() => expect(h.auth.loading).toBe(false));
  act(() => h.auth.setToken('synthetic-A', 101, { roles: ['admin'], modules: ['admin'] }));
  await waitFor(() => expect(h.reads).toEqual(['101']));
  const oldClient = h.client;
  const button = h.view.getAllByLabelText(/^Favorito /)[0];
  const label = String(button.props.accessibilityLabel).replace(/^Favorito /, '');
  if (kind === 'favorite') {
    fireEvent.press(button);
    await waitFor(() => expect(put).toHaveBeenCalled());
    saved.featureId = decodeURIComponent(String(jest.mocked(put).mock.calls[0][0]).split('/').pop()!);
  } else {
    fireEvent.press(h.view.getByText(label));
    await waitFor(() => expect(post).toHaveBeenCalled());
    saved.featureId = decodeURIComponent(String(jest.mocked(post).mock.calls[0][0]).split('/').at(-2)!);
  }
  act(() => h.show(false));
  act(() => h.auth.clearToken());
  act(() => h.auth.setToken('synthetic-B', 202, { roles: ['admin'], modules: ['admin'] }));
  await waitFor(() => expect(h.reads).toEqual(['101', '202']));
  expect(h.client).not.toBe(oldClient);
  await act(async () => { pending.resolve(saved); await pending.promise; });
  // The actual screen callback runs and writes A's retired cache. It cannot
  // reach B's distinct client, even though both use an actorless query key.
  await waitFor(() => expect(oldClient.getQueryData(['navigation-preferences'])).toEqual([saved]));
  expect(h.client.getQueryData(['navigation-preferences'])).toEqual([]);
  expect(h.view.queryByLabelText(`Quitar favorito ${label}`)).toBeNull();
  expect(h.auth.partyId).toBe('202');
  h.close();
});

it('allocates a fresh cache for batched same-token relogin, A-B-A and changed role scope', async () => {
  const h = await harness();
  await waitFor(() => expect(h.auth.loading).toBe(false));
  act(() => h.auth.setToken('synthetic-A', 101));
  await waitFor(() => expect(h.reads).toHaveLength(1));
  const first = h.client;
  act(() => { h.auth.clearToken(); h.auth.setToken('synthetic-A', 101); });
  expect(h.client).not.toBe(first);
  await waitFor(() => expect(h.reads).toHaveLength(2));
  const second = h.client;
  act(() => h.auth.setToken('synthetic-B', 202));
  await waitFor(() => expect(h.reads).toHaveLength(3));
  act(() => h.auth.setToken('synthetic-A', 101));
  await waitFor(() => expect(h.reads).toHaveLength(4));
  expect(h.client).not.toBe(first);
  expect(h.client).not.toBe(second);
  const third = h.client;
  const epoch = h.auth.sessionEpoch;
  jest.mocked(get).mockResolvedValueOnce({ partyId: 101, roles: ['admin'] } as never);
  await act(async () => { await h.auth.refreshSession(); });
  expect(h.auth.sessionEpoch).toBe(epoch);
  expect(h.client).not.toBe(third);
  await waitFor(() => expect(h.reads).toHaveLength(5));
  const sameScope = h.client;
  jest.mocked(get).mockResolvedValueOnce({ partyId: 101, roles: ['admin'] } as never);
  await act(async () => { await h.auth.refreshSession(); });
  expect(h.client).toBe(sameScope);
  expect(h.reads).toHaveLength(5);
  expect(h.client.getDefaultOptions().mutations?.retry).toBe(0);
  h.close();
});
