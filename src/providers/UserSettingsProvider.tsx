import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserSettings = {
  partyId: string | null;
  displayName: string | null;
};

type UserSettingsContextValue = {
  partyId: string | null;
  displayName: string | null;
  loading: boolean;
  setIdentity: (partyId: string | null, displayName?: string | null) => void;
  clearIdentity: () => void;
};

const STORAGE_KEY = 'tdf-user-settings';
const EMPTY_SETTINGS: UserSettings = { partyId: null, displayName: null };

const UserSettingsContext = createContext<UserSettingsContextValue | undefined>(undefined);

const normalizeStoredString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export const parseUserSettings = (raw: string): UserSettings | null => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    return {
      partyId: normalizeStoredString(value.partyId),
      displayName: normalizeStoredString(value.displayName),
    };
  } catch {
    return null;
  }
};

export function UserSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<UserSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const settingsVersionRef = useRef(0);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      settingsVersionRef.current += 1;
    };
  }, []);

  const queuePersist = useCallback((next: UserSettings): Promise<void> => {
    const queued = persistQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          if (!next.partyId && !next.displayName) {
            await AsyncStorage.removeItem(STORAGE_KEY);
            return;
          }
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage failures to avoid unhandled rejections in event handlers.
        }
      });

    persistQueueRef.current = queued;
    return queued;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrapVersion = settingsVersionRef.current;
    const isStaleBootstrap = () =>
      cancelled || !isMountedRef.current || bootstrapVersion !== settingsVersionRef.current;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (isStaleBootstrap() || !raw) return;

        const parsed = parseUserSettings(raw);
        if (parsed) {
          setSettings(parsed);
          return;
        }

        await queuePersist(EMPTY_SETTINGS);
      } catch {
        // Keep defaults when storage can't be read instead of deleting potentially valid data.
      } finally {
        if (!cancelled && isMountedRef.current) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queuePersist]);

  const persist = useCallback(async (next: UserSettings) => {
    settingsVersionRef.current += 1;
    setLoading(false);
    setSettings(next);
    await queuePersist(next);
  }, [queuePersist]);

  const setIdentity = useCallback((partyId: string | null, displayName?: string | null) => {
    const normalizedId = partyId?.trim() || null;
    const normalizedName = displayName?.trim() || null;
    void persist({ partyId: normalizedId, displayName: normalizedName });
  }, [persist]);

  const clearIdentity = useCallback(() => {
    void persist({ partyId: null, displayName: null });
  }, [persist]);

  const value = useMemo<UserSettingsContextValue>(() => ({
    partyId: settings.partyId,
    displayName: settings.displayName,
    loading,
    setIdentity,
    clearIdentity
  }), [settings.partyId, settings.displayName, loading, setIdentity, clearIdentity]);

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings(): UserSettingsContextValue {
  const ctx = useContext(UserSettingsContext);
  if (!ctx) throw new Error('useUserSettings must be used within UserSettingsProvider');
  return ctx;
}
