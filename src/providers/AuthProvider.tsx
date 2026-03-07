import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setAuthToken, getAuthToken, get, normalizeAuthToken } from '../api/client';
import type { Party } from '../types';

type AuthContextValue = {
  token: string | null;
  partyId: string | null;
  loading: boolean;
  setToken: (next: string | null) => void;
  clearToken: () => void;
};

const STORAGE_KEY = 'tdf-auth-token';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeToken = (value: string | null | undefined): string | null => {
  return normalizeAuthToken(value) ?? null;
};

const persistStoredToken = async (token: string | null): Promise<void> => {
  try {
    if (token) {
      await AsyncStorage.setItem(STORAGE_KEY, token);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures to avoid unhandled rejections in callers.
  }
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setTokenState] = useState<string | null>(normalizeToken(getAuthToken()));
  const [partyId, setPartyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const profileLookupIdRef = useRef(0);
  const authVersionRef = useRef(0);

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
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const normalized = normalizeToken(stored);

        if (isStaleBootstrap()) return;

        if (!normalized) {
          if (stored) {
            await persistStoredToken(null);
            if (isStaleBootstrap()) return;
          }

          syncTokenState(null);
          await refreshPartyId(null);
          return;
        }

        if (stored !== normalized) {
          await persistStoredToken(normalized);
          if (isStaleBootstrap()) return;
        }

        syncTokenState(normalized);
        await refreshPartyId(normalized);
      } catch {
        if (isStaleBootstrap()) return;

        syncTokenState(null);
        await refreshPartyId(null);
      } finally {
        if (!cancelled && isMountedRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshPartyId, syncTokenState]);

  const setToken = useCallback((next: string | null) => {
    authVersionRef.current += 1;
    const normalized = normalizeToken(next);
    setLoading(false);
    syncTokenState(normalized);

    void persistStoredToken(normalized);

    void refreshPartyId(normalized);
  }, [refreshPartyId, syncTokenState]);

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
