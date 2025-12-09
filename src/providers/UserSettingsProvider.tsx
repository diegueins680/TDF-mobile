import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

const UserSettingsContext = createContext<UserSettingsContextValue | undefined>(undefined);

export function UserSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<UserSettings>({ partyId: null, displayName: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as UserSettings;
          setSettings({
            partyId: parsed.partyId ?? null,
            displayName: parsed.displayName ?? null
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (next: UserSettings) => {
    setSettings(next);
    if (!next.partyId && !next.displayName) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

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
