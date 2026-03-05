import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setAuthToken, getAuthToken, get } from '../api/client';
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
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setTokenState] = useState<string | null>(normalizeToken(getAuthToken()));
  const [partyId, setPartyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const profileLookupIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      profileLookupIdRef.current += 1;
    };
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
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const normalized = normalizeToken(stored);

        if (!normalized) {
          if (stored) {
            await AsyncStorage.removeItem(STORAGE_KEY);
          }
          if (isMountedRef.current) {
            setTokenState(null);
            setAuthToken(null);
          }
          await refreshPartyId(null);
          return;
        }

        if (stored !== normalized) {
          await AsyncStorage.setItem(STORAGE_KEY, normalized);
        }

        if (isMountedRef.current) {
          setTokenState(normalized);
          setAuthToken(normalized);
        }
        await refreshPartyId(normalized);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    })();
  }, [refreshPartyId]);

  const setToken = useCallback((next: string | null) => {
    const normalized = normalizeToken(next);
    setTokenState(normalized);
    setAuthToken(normalized);

    if (normalized) {
      void AsyncStorage.setItem(STORAGE_KEY, normalized);
    } else {
      void AsyncStorage.removeItem(STORAGE_KEY);
    }

    void refreshPartyId(normalized);
  }, [refreshPartyId]);

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
