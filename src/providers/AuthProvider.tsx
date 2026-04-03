import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';

import { setAuthToken, getAuthToken, get, normalizeAuthToken } from '../api/client';
import type { Party } from '../types';

type AuthContextValue = {
  token: string | null;
  partyId: string | null;
  loading: boolean;
  setToken: (next: string | null) => void;
  clearToken: () => void;
};

const SECURE_STORAGE_KEY = 'tdf-auth-token';
const LEGACY_STORAGE_KEY = 'tdf-auth-token';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeToken = (value: string | null | undefined): string | null => {
  return normalizeAuthToken(value) ?? null;
};

const readSecureToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(SECURE_STORAGE_KEY);
  } catch {
    return null;
  }
};

const persistSecureToken = async (next: string | null): Promise<boolean> => {
  try {
    if (next) {
      await SecureStore.setItemAsync(SECURE_STORAGE_KEY, next);
    } else {
      await SecureStore.deleteItemAsync(SECURE_STORAGE_KEY);
    }

    return true;
  } catch {
    return false;
  }
};

const readLegacyToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return null;
  }
};

const clearLegacyToken = async () => {
  try {
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage failures to avoid unhandled rejections in callers.
  }
};

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(normalizeToken(getAuthToken()));
  const [partyId, setPartyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const profileLookupIdRef = useRef(0);
  const authVersionRef = useRef(0);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const appliedTokenRef = useRef<string | null>(normalizeToken(getAuthToken()));

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      profileLookupIdRef.current += 1;
      authVersionRef.current += 1;
    };
  }, []);

  const syncTokenState = useCallback((next: string | null) => {
    setTokenState(next);
    setAuthToken(next);
  }, []);

  const applyAuthState = useCallback((next: string | null) => {
    syncTokenState(next);

    if (appliedTokenRef.current === next) return;

    appliedTokenRef.current = next;
    setPartyIdState(null);
    queryClient.clear();
  }, [queryClient, syncTokenState]);

  const persistStoredToken = useCallback((
    next: string | null,
    options?: { preserveLegacyOnFailure?: boolean }
  ): Promise<void> => {
    const queued = persistQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const securePersisted = await persistSecureToken(next);

        if (!options?.preserveLegacyOnFailure || securePersisted || next === null) {
          await clearLegacyToken();
        }
      });

    persistQueueRef.current = queued;
    return queued;
  }, []);

  const refreshPartyId = useCallback(async (forToken: string | null) => {
    const lookupId = ++profileLookupIdRef.current;

    if (!forToken) {
      if (isMountedRef.current && lookupId === profileLookupIdRef.current) {
        setPartyIdState(null);
      }
      return;
    }

    try {
      const profile = await get<Party>('/parties/me');
      if (isMountedRef.current && lookupId === profileLookupIdRef.current) {
        setPartyIdState(String(profile.id));
      }
    } catch (_) {
      if (isMountedRef.current && lookupId === profileLookupIdRef.current) {
        setPartyIdState(null);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrapVersion = authVersionRef.current;
    const isStaleBootstrap = () =>
      cancelled || !isMountedRef.current || bootstrapVersion !== authVersionRef.current;

    (async () => {
      try {
        const secureStored = await readSecureToken();
        const legacyStored = await readLegacyToken();
        const secureToken = normalizeToken(secureStored);
        const legacyToken = normalizeToken(legacyStored);
        const inMemoryToken = normalizeToken(getAuthToken());
        const bootstrapToken = secureToken ?? legacyToken ?? inMemoryToken;

        if (isStaleBootstrap()) return;

        if (!bootstrapToken) {
          if (secureStored || legacyStored) {
            await persistStoredToken(null);
            if (isStaleBootstrap()) return;
          }

          applyAuthState(null);
          await refreshPartyId(null);
          return;
        }

        if (
          secureStored !== bootstrapToken ||
          legacyStored !== null ||
          (secureStored === null && legacyStored === null)
        ) {
          await persistStoredToken(bootstrapToken, {
            preserveLegacyOnFailure: Boolean(legacyToken) && !secureToken
          });
          if (isStaleBootstrap()) return;
        }

        applyAuthState(bootstrapToken);
        await refreshPartyId(bootstrapToken);
      } catch {
        if (isStaleBootstrap()) return;

        const inMemoryToken = normalizeToken(getAuthToken());
        applyAuthState(inMemoryToken);
        await refreshPartyId(inMemoryToken);
      } finally {
        if (!cancelled && isMountedRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyAuthState, persistStoredToken, refreshPartyId]);

  const setToken = useCallback((next: string | null) => {
    authVersionRef.current += 1;
    const normalized = normalizeToken(next);
    setLoading(false);
    applyAuthState(normalized);

    void persistStoredToken(normalized);

    void refreshPartyId(normalized);
  }, [applyAuthState, persistStoredToken, refreshPartyId]);

  const clearToken = useCallback(() => setToken(null), [setToken]);

  const value = useMemo<AuthContextValue>(
    () => ({ token, partyId, loading, setToken, clearToken }),
    [token, partyId, loading, setToken, clearToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
