import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setTokenState] = useState<string | null>(getAuthToken() ?? null);
  const [partyId, setPartyIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setTokenState(stored);
          setAuthToken(stored);
          try {
            const profile = await get<Party>('/parties/me');
            setPartyIdState(String(profile.id));
          } catch (_) {
            setPartyIdState(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setToken = useCallback((next: string | null) => {
    const normalized = next?.trim() ?? null;
    setTokenState(normalized);
    setAuthToken(normalized);
    if (normalized) {
      void AsyncStorage.setItem(STORAGE_KEY, normalized);
      (async () => {
        try {
          const profile = await get<Party>('/parties/me');
          setPartyIdState(String(profile.id));
        } catch (_) {
          setPartyIdState(null);
        }
      })();
    } else {
      setPartyIdState(null);
      void AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

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
