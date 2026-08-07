import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePartyId } from '../lib/identity';
import { getLocalePreferences, updateLocalePreferences } from '../api/preferences';
import { useOptionalAuth } from './AuthProvider';

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'pt'] as const;
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'BRL'] as const;

type UserSettings = {
  partyId: string | null;
  displayName: string | null;
  locale: string;
  currency: string;
  timezone: string;
  countryCode: string | null;
};

type UserSettingsUpdate = UserSettings | ((current: UserSettings) => UserSettings);

type UserSettingsContextValue = {
  partyId: string | null;
  displayName: string | null;
  locale: string;
  currency: string;
  timezone: string;
  countryCode: string | null;
  supportedLocales: readonly string[];
  supportedCurrencies: readonly string[];
  loading: boolean;
  setIdentity: (partyId: string | null, displayName?: string | null) => void;
  clearIdentity: () => void;
  setRegionalPreferences: (preferences: Partial<Pick<UserSettings, 'locale' | 'currency' | 'timezone' | 'countryCode'>>) => void;
};

const STORAGE_KEY = 'tdf-user-settings';
const resolvedIntl = Intl.DateTimeFormat().resolvedOptions();
const detectedLocaleParts = (resolvedIntl.locale || 'en').split(/[-_]/);
const configuredLocale = process.env.EXPO_PUBLIC_DEFAULT_LOCALE?.trim().toLowerCase() || 'es';
const configuredCurrency = process.env.EXPO_PUBLIC_DEFAULT_CURRENCY?.trim().toUpperCase() ?? 'USD';
const EMPTY_SETTINGS: UserSettings = {
  partyId: null,
  displayName: null,
  locale: SUPPORTED_LOCALES.includes(configuredLocale as (typeof SUPPORTED_LOCALES)[number]) ? configuredLocale : 'es',
  currency: SUPPORTED_CURRENCIES.includes(configuredCurrency as (typeof SUPPORTED_CURRENCIES)[number])
    ? configuredCurrency
    : 'USD',
  timezone: process.env.EXPO_PUBLIC_TZ?.trim() || resolvedIntl.timeZone || 'UTC',
  countryCode: detectedLocaleParts[1]?.toUpperCase() ?? null,
};

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
      partyId: normalizePartyId(
        typeof value.partyId === 'number' || typeof value.partyId === 'string' ? value.partyId : null,
      ),
      displayName: normalizeStoredString(value.displayName),
      locale: SUPPORTED_LOCALES.includes(normalizeStoredString(value.locale)?.toLowerCase() as (typeof SUPPORTED_LOCALES)[number])
        ? normalizeStoredString(value.locale)?.toLowerCase() ?? EMPTY_SETTINGS.locale
        : EMPTY_SETTINGS.locale,
      currency: SUPPORTED_CURRENCIES.includes(normalizeStoredString(value.currency)?.toUpperCase() as (typeof SUPPORTED_CURRENCIES)[number])
        ? normalizeStoredString(value.currency)?.toUpperCase() ?? EMPTY_SETTINGS.currency
        : EMPTY_SETTINGS.currency,
      timezone: normalizeStoredString(value.timezone) ?? EMPTY_SETTINGS.timezone,
      countryCode: normalizeStoredString(value.countryCode)?.toUpperCase() ?? EMPTY_SETTINGS.countryCode,
    };
  } catch {
    return null;
  }
};

export function UserSettingsProvider({ children }: PropsWithChildren) {
  const auth = useOptionalAuth();
  const [settings, setSettings] = useState<UserSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const settingsVersionRef = useRef(0);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const settingsRef = useRef<UserSettings>(EMPTY_SETTINGS);

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
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage failures to avoid unhandled rejections in event handlers.
        }
      });

    persistQueueRef.current = queued;
    return queued;
  }, []);

  const applySettings = useCallback((next: UserSettings) => {
    settingsRef.current = next;
    setSettings(next);
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
          applySettings(parsed);
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
  }, [applySettings, queuePersist]);

  const persist = useCallback(async (nextUpdate: UserSettingsUpdate) => {
    settingsVersionRef.current += 1;
    setLoading(false);
    const next =
      typeof nextUpdate === 'function'
        ? nextUpdate(settingsRef.current)
        : nextUpdate;
    applySettings(next);
    await queuePersist(next);
  }, [applySettings, queuePersist]);

  useEffect(() => {
    if (!auth?.token || loading) return;
    let cancelled = false;
    void getLocalePreferences()
      .then((remote) => {
        if (cancelled) return;
        void persist((current) => ({
          ...current,
          locale: remote.locale,
          currency: remote.currency,
          timezone: remote.timezone,
          countryCode: remote.countryCode,
        }));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [auth?.token, loading, persist]);

  const setIdentity = useCallback((partyId: string | null, displayName?: string | null) => {
    void persist((current) => ({
      ...current,
      partyId: normalizePartyId(partyId),
      displayName:
        displayName === undefined ? current.displayName : displayName?.trim() || null,
    }));
  }, [persist]);

  const clearIdentity = useCallback(() => {
    void persist((current) => ({ ...current, partyId: null, displayName: null }));
  }, [persist]);

  const setRegionalPreferences = useCallback((update: Partial<Pick<UserSettings, 'locale' | 'currency' | 'timezone' | 'countryCode'>>) => {
    const current = settingsRef.current;
    const next = {
      ...current,
      locale: SUPPORTED_LOCALES.includes(update.locale?.toLowerCase() as (typeof SUPPORTED_LOCALES)[number])
        ? update.locale!.toLowerCase()
        : current.locale,
      currency: SUPPORTED_CURRENCIES.includes(update.currency?.toUpperCase() as (typeof SUPPORTED_CURRENCIES)[number])
        ? update.currency!.toUpperCase()
        : current.currency,
      timezone: update.timezone?.trim() || current.timezone,
      countryCode: update.countryCode === undefined ? current.countryCode : update.countryCode?.trim().toUpperCase() || null,
    };
    void persist(next);
    if (auth?.token) {
      void updateLocalePreferences({
        locale: next.locale,
        currency: next.currency,
        timezone: next.timezone,
        countryCode: next.countryCode,
      }).catch(() => undefined);
    }
  }, [auth?.token, persist]);

  const value = useMemo<UserSettingsContextValue>(() => ({
    partyId: settings.partyId,
    displayName: settings.displayName,
    locale: settings.locale,
    currency: settings.currency,
    timezone: settings.timezone,
    countryCode: settings.countryCode,
    supportedLocales: SUPPORTED_LOCALES,
    supportedCurrencies: SUPPORTED_CURRENCIES,
    loading,
    setIdentity,
    clearIdentity,
    setRegionalPreferences,
  }), [settings, loading, setIdentity, clearIdentity, setRegionalPreferences]);

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
