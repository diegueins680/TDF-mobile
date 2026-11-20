import React, { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { get, getAuthToken, setAuthToken } from '../src/api/client';
import { revokePushRegistration } from '../src/notifications/pushSubscriptions';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../src/notifications/pushSubscriptions', () => ({ revokePushRegistration: jest.fn() }));
jest.mock('../src/api/client', () => {
  let current: string | undefined;
  return {
    get: jest.fn(),
    getAuthToken: jest.fn(() => current),
    setAuthToken: jest.fn((value: string | null) => { current = value ?? undefined; }),
    normalizeAuthToken: (value?: string | null) => {
      const trimmed = value?.trim();
      if (!trimmed) return undefined;
      return /^bearer\b/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
    },
  };
});

const revoke = jest.mocked(revokePushRegistration);
const wrapper = ({ children }: PropsWithChildren) => <AuthProvider>{children}</AuthProvider>;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('stored-session');
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue();
  jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue();
  jest.mocked(get).mockResolvedValue({ partyId: 42 } as never);
});

async function signedIn() {
  const hook = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.partyId).toBe('42'));
  expect(hook.result.current.token).toBe('Bearer stored-session');
  return hook;
}

it('revokes the push token with the live session before clearing auth', async () => {
  const seenAtRevoke: Array<string | undefined> = [];
  revoke.mockImplementation(async () => { seenAtRevoke.push(getAuthToken()); });
  const { result } = await signedIn();

  await act(async () => { await result.current.clearTokenPersisted(); });

  expect(revoke).toHaveBeenCalledWith('Bearer stored-session');
  expect(seenAtRevoke).toEqual(['Bearer stored-session']);
  const revokeOrder = revoke.mock.invocationCallOrder[0];
  const clearOrder = jest.mocked(setAuthToken).mock.calls.findIndex(([value]) => value === null);
  expect(clearOrder).toBeGreaterThanOrEqual(0);
  expect(jest.mocked(setAuthToken).mock.invocationCallOrder[clearOrder]).toBeGreaterThan(revokeOrder);
  expect(result.current.token).toBeNull();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
});

it('still logs out when the revoke fails', async () => {
  revoke.mockRejectedValue(new Error('offline'));
  const { result } = await signedIn();

  let durable: boolean | undefined;
  await act(async () => { durable = await result.current.clearTokenPersisted(); });

  expect(revoke).toHaveBeenCalledTimes(1);
  expect(durable).toBe(true);
  expect(result.current.token).toBeNull();
  expect(getAuthToken()).toBeUndefined();
});

it('starts the revoke with the captured session for the synchronous logout too', async () => {
  revoke.mockImplementation(() => new Promise(() => {}));
  const { result } = await signedIn();

  act(() => { result.current.clearToken(); });

  expect(revoke).toHaveBeenCalledWith('Bearer stored-session');
  await waitFor(() => expect(result.current.token).toBeNull());
});
