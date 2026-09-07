import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { AppState, Platform } from 'react-native';

import { setAuthToken, getAuthToken, get, normalizeAuthToken } from '../api/client';

export type AuthSessionSnapshot = {
  partyId: string | null;
  username: string | null;
  displayName: string | null;
  roles: string[];
  modules: string[];
  featureFlags: string[];
};

type AuthContextValue = {
  token: string | null;
  partyId: string | null;
  session: AuthSessionSnapshot | null;
  roles: string[];
  modules: string[];
  featureFlags: string[];
  loading: boolean;
  setToken: (
    next: string | null,
    nextPartyId?: string | number | null,
    nextSession?: Partial<AuthSessionSnapshot> | null,
  ) => void;
  clearToken: () => void;
  refreshSession: () => Promise<void>;
};

const SECURE_STORAGE_KEY = 'tdf-auth-token';
const LEGACY_STORAGE_KEY = 'tdf-auth-token';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeToken = (value: string | null | undefined): string | null => {
  return normalizeAuthToken(value) ?? null;
};

type SessionSnapshot = {
  partyId?: string | number | null;
  id?: string | number | null;
  username?: string | null;
  displayName?: string | null;
  roles?: unknown;
  modules?: unknown;
  featureFlags?: unknown;
};

const normalizePartyId = (value: string | number | null | undefined): string | null => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? String(value) : null;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return /^[1-9]\d*$/.test(trimmed) ? trimmed : null;
};

const readPartyId = (value: SessionSnapshot | null | undefined): string | null => {
  return normalizePartyId(value?.partyId ?? value?.id ?? null);
};

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    if (typeof entry !== 'string') return [];
    const normalized = entry.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return [];
    seen.add(normalized);
    return [normalized];
  });
};

const normalizeOptionalText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const normalizeSessionSnapshot = (
  value: SessionSnapshot | Partial<AuthSessionSnapshot> | null | undefined,
  fallbackPartyId: string | null = null,
): AuthSessionSnapshot => ({
  partyId: readPartyId(value as SessionSnapshot) ?? fallbackPartyId,
  username: normalizeOptionalText(value?.username),
  displayName: normalizeOptionalText(value?.displayName),
  roles: normalizeStringList(value?.roles),
  modules: normalizeStringList(value?.modules),
  featureFlags: normalizeStringList(value?.featureFlags),
});

const readSecureToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') return null;

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
  const [session, setSessionState] = useState<AuthSessionSnapshot | null>(null);
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
    setSessionState(null);
    queryClient.clear();
  }, [queryClient, syncTokenState]);

  const persistStoredToken = useCallback((
    next: string | null,
    options?: { preserveLegacyOnFailure?: boolean }
  ): Promise<void> => {
    const queued = persistQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (Platform.OS === 'web') {
          try {
            if (next) {
              await AsyncStorage.setItem(LEGACY_STORAGE_KEY, next);
            } else {
              await clearLegacyToken();
            }
          } catch {
            // Keep the in-memory auth state usable when browser storage is unavailable.
          }
          return;
        }

        const securePersisted = await persistSecureToken(next);

        if (!options?.preserveLegacyOnFailure || securePersisted || next === null) {
          await clearLegacyToken();
        }
      });

    persistQueueRef.current = queued;
    return queued;
  }, []);

  const refreshPartyId = useCallback(async (
    forToken: string | null,
    fallbackPartyId?: string | null
  ) => {
    const lookupId = ++profileLookupIdRef.current;

    if (!forToken) {
      if (isMountedRef.current && lookupId === profileLookupIdRef.current) {
        setPartyIdState(null);
      }
      return;
    }

    try {
      const sessionValue = await get<SessionSnapshot | null>('/session');
      if (isMountedRef.current && lookupId === profileLookupIdRef.current) {
        if (sessionValue === null) {
          authVersionRef.current += 1;
          applyAuthState(null);
          await persistStoredToken(null);
          return;
        }
        const normalizedSession = normalizeSessionSnapshot(sessionValue, fallbackPartyId ?? null);
        setPartyIdState(normalizedSession.partyId);
        setSessionState(normalizedSession);
      }
    } catch (error) {
      if (isMountedRef.current && lookupId === profileLookupIdRef.current) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          authVersionRef.current += 1;
          applyAuthState(null);
          await persistStoredToken(null);
          return;
        }
        setPartyIdState(fallbackPartyId ?? null);
        setSessionState((current) => current ?? normalizeSessionSnapshot(null, fallbackPartyId ?? null));
      }
    }
  }, [applyAuthState, persistStoredToken]);

  const refreshSession = useCallback(async () => {
    await refreshPartyId(token, partyId);
  }, [partyId, refreshPartyId, token]);

  useEffect(() => {
    if (!token) return;
    let lastRefreshAt = 0;
    const refreshIfNeeded = () => {
      const now = Date.now();
      if (now - lastRefreshAt < 60_000) return;
      lastRefreshAt = now;
      void refreshPartyId(token, partyId);
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshIfNeeded();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') refreshIfNeeded();
    }, 5 * 60_000);
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [partyId, refreshPartyId, token]);

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

  const setToken = useCallback((
    next: string | null,
    nextPartyId?: string | number | null,
    nextSession?: Partial<AuthSessionSnapshot> | null,
  ) => {
    authVersionRef.current += 1;
    profileLookupIdRef.current += 1;
    const normalized = normalizeToken(next);
    const normalizedPartyId = normalized ? normalizePartyId(nextPartyId) : null;
    setLoading(false);
    applyAuthState(normalized);

    if (normalized === null || normalizedPartyId !== null) {
      setPartyIdState(normalizedPartyId);
    }
    if (normalized && nextSession) {
      setSessionState(normalizeSessionSnapshot(nextSession, normalizedPartyId));
    }

    void persistStoredToken(normalized);

    if (normalized && normalizedPartyId === null) {
      void refreshPartyId(normalized);
    }
  }, [applyAuthState, persistStoredToken, refreshPartyId]);

  const clearToken = useCallback(() => setToken(null), [setToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      partyId,
      session,
      roles: session?.roles ?? [],
      modules: session?.modules ?? [],
      featureFlags: session?.featureFlags ?? [],
      loading,
      setToken,
      clearToken,
      refreshSession,
    }),
    [token, partyId, session, loading, setToken, clearToken, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useOptionalAuth(): AuthContextValue | undefined {
  return useContext(AuthContext);
}
