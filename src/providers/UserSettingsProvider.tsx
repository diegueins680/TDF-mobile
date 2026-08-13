import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePartyId } from '../lib/identity';
import { getLocalePreferences, updateLocalePreferences } from '../api/preferences';
import type { RecordsFeed } from '../api/records';
import { useOptionalAuth } from './AuthProvider';
import {
  catalogCodes,
  catalogDefaults as selectCatalogDefaults,
  catalogItems as selectCatalogItems,
  emergencyCatalogSnapshot,
  loadLastKnownGoodCatalogSnapshot,
  refreshCatalogSnapshot,
  type CatalogSnapshot,
} from '../lib/catalogSnapshot';
import type { CatalogDefault, CatalogItem } from '../api/catalogs';
import {
  loadLastKnownGoodRecordsSnapshot,
  refreshRecordsSnapshot,
  type RecordsSnapshot,
} from '../lib/recordsSnapshot';

const EMERGENCY_CATALOGS = emergencyCatalogSnapshot();
const EMERGENCY_LOCALES = catalogCodes(EMERGENCY_CATALOGS, 'locales');
const EMERGENCY_CURRENCIES = catalogCodes(EMERGENCY_CATALOGS, 'currencies');

type UserSettings = {
  partyId: string | null;
  displayName: string | null;
  localeId: string;
  locale: string;
  currencyId: string;
  currency: string;
  timezone: string;
  countryId: string | null;
  countryCode: string | null;
};

type UserSettingsUpdate = UserSettings | ((current: UserSettings) => UserSettings);

type UserSettingsContextValue = {
  partyId: string | null;
  displayName: string | null;
  localeId: string;
  locale: string;
  currencyId: string;
  currency: string;
  timezone: string;
  countryId: string | null;
  countryCode: string | null;
  supportedLocales: readonly string[];
  supportedCurrencies: readonly string[];
  catalogRevision: number;
  catalogSource: 'network' | 'emergency';
  catalogSyncing: boolean;
  getCatalogItems: (catalogCode: string) => readonly CatalogItem[];
  getCatalogDefaults: (catalogCode: string) => readonly CatalogDefault[];
  recordsFeed: RecordsFeed | null;
  recordsRevision: number | null;
  recordsSource: 'network' | 'cache' | 'unavailable';
  refreshCatalogs: () => Promise<void>;
  loading: boolean;
  setIdentity: (partyId: string | null, displayName?: string | null) => void;
  clearIdentity: () => void;
  setRegionalPreferences: (preferences: Partial<Pick<UserSettings, 'localeId' | 'currencyId' | 'timezone' | 'countryId'>>) => void;
};

const STORAGE_KEY = 'tdf-user-settings';
const resolvedIntl = Intl.DateTimeFormat().resolvedOptions();
const detectedLocaleParts = (resolvedIntl.locale || 'en').split(/[-_]/);
const detectedLanguage = detectedLocaleParts[0]?.toLowerCase() ?? 'en';
const configuredCurrency = process.env.EXPO_PUBLIC_DEFAULT_CURRENCY?.trim().toUpperCase() ?? 'USD';
const emergencyLocale = selectCatalogItems(EMERGENCY_CATALOGS, 'locales')
  .find((item) => item.code === detectedLanguage)
  ?? selectCatalogItems(EMERGENCY_CATALOGS, 'locales')[0];
const emergencyCurrency = selectCatalogItems(EMERGENCY_CATALOGS, 'currencies')
  .find((item) => item.code === configuredCurrency)
  ?? selectCatalogItems(EMERGENCY_CATALOGS, 'currencies')[0];
const EMPTY_SETTINGS: UserSettings = {
  partyId: null,
  displayName: null,
  localeId: emergencyLocale?.id ?? '',
  locale: emergencyLocale?.code ?? 'es',
  currencyId: emergencyCurrency?.id ?? '',
  currency: emergencyCurrency?.code ?? 'USD',
  timezone: process.env.EXPO_PUBLIC_TZ?.trim() || resolvedIntl.timeZone || 'UTC',
  countryId: null,
  countryCode: detectedLocaleParts[1]?.toUpperCase() ?? null,
};

const UserSettingsContext = createContext<UserSettingsContextValue | undefined>(undefined);

const normalizeStoredString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const normalizeStoredUuid = (value: unknown): string => {
  const normalized = normalizeStoredString(value)?.toLowerCase() ?? '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : '';
};

export const parseUserSettings = (
  raw: string,
  supportedLocales: readonly string[] = EMERGENCY_LOCALES,
  supportedCurrencies: readonly string[] = EMERGENCY_CURRENCIES,
): UserSettings | null => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    return {
      partyId: normalizePartyId(
        typeof value.partyId === 'number' || typeof value.partyId === 'string' ? value.partyId : null,
      ),
      displayName: normalizeStoredString(value.displayName),
      localeId: normalizeStoredUuid(value.localeId),
      locale: supportedLocales.includes(normalizeStoredString(value.locale)?.toLowerCase() ?? '')
        ? normalizeStoredString(value.locale)?.toLowerCase() ?? EMPTY_SETTINGS.locale
        : EMPTY_SETTINGS.locale,
      currencyId: normalizeStoredUuid(value.currencyId),
      currency: supportedCurrencies.includes(normalizeStoredString(value.currency)?.toUpperCase() ?? '')
        ? normalizeStoredString(value.currency)?.toUpperCase() ?? EMPTY_SETTINGS.currency
        : EMPTY_SETTINGS.currency,
      timezone: normalizeStoredString(value.timezone) ?? EMPTY_SETTINGS.timezone,
      countryId: normalizeStoredString(value.countryId),
      countryCode: normalizeStoredString(value.countryCode)?.toUpperCase() ?? EMPTY_SETTINGS.countryCode,
    };
  } catch {
    return null;
  }
};

export function UserSettingsProvider({ children }: PropsWithChildren) {
  const auth = useOptionalAuth();
  const [settings, setSettings] = useState<UserSettings>(EMPTY_SETTINGS);
  const [catalogSnapshot, setCatalogSnapshot] = useState<CatalogSnapshot>(EMERGENCY_CATALOGS);
  const [recordsSnapshot, setRecordsSnapshot] = useState<RecordsSnapshot | null>(null);
  const [catalogSyncing, setCatalogSyncing] = useState(true);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const settingsVersionRef = useRef(0);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const settingsRef = useRef<UserSettings>(EMPTY_SETTINGS);
  const catalogSnapshotRef = useRef<CatalogSnapshot>(EMERGENCY_CATALOGS);
  const recordsSnapshotRef = useRef<RecordsSnapshot | null>(null);

  const applyCatalogSnapshot = useCallback((next: CatalogSnapshot) => {
    catalogSnapshotRef.current = next;
    setCatalogSnapshot(next);
  }, []);

  const applyRecordsSnapshot = useCallback((next: RecordsSnapshot | null) => {
    recordsSnapshotRef.current = next;
    setRecordsSnapshot(next);
  }, []);

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
        const [raw, cachedCatalogs, cachedRecords] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          loadLastKnownGoodCatalogSnapshot(),
          loadLastKnownGoodRecordsSnapshot(),
        ]);
        if (isStaleBootstrap()) return;
        const availableCatalogs = cachedCatalogs ?? EMERGENCY_CATALOGS;
        applyCatalogSnapshot(availableCatalogs);
        applyRecordsSnapshot(cachedRecords);
        if (!raw) return;

        const parsed = parseUserSettings(
          raw,
          catalogCodes(availableCatalogs, 'locales'),
          catalogCodes(availableCatalogs, 'currencies'),
        );
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
  }, [applyCatalogSnapshot, applyRecordsSnapshot, applySettings, queuePersist]);

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

  const refreshCatalogs = useCallback(async () => {
    setCatalogSyncing(true);
    try {
      const locale = settingsRef.current.locale;
      const [nextCatalogs, nextRecords] = await Promise.all([
        refreshCatalogSnapshot(locale, catalogSnapshotRef.current),
        refreshRecordsSnapshot(locale, recordsSnapshotRef.current),
      ]);
      if (isMountedRef.current) {
        applyCatalogSnapshot(nextCatalogs);
        applyRecordsSnapshot(nextRecords);
      }
    } finally {
      if (isMountedRef.current) setCatalogSyncing(false);
    }
  }, [applyCatalogSnapshot, applyRecordsSnapshot]);

  useEffect(() => {
    if (loading) return;
    void refreshCatalogs();
  }, [loading, refreshCatalogs]);

  const supportedLocales = useMemo(() => catalogCodes(catalogSnapshot, 'locales'), [catalogSnapshot]);
  const supportedCurrencies = useMemo(() => catalogCodes(catalogSnapshot, 'currencies'), [catalogSnapshot]);
  const getCatalogItems = useCallback(
    (catalogCode: string) => selectCatalogItems(catalogSnapshot, catalogCode),
    [catalogSnapshot],
  );
  const getCatalogDefaults = useCallback(
    (catalogCode: string) => selectCatalogDefaults(catalogSnapshot, catalogCode),
    [catalogSnapshot],
  );

  useEffect(() => {
    if (catalogSnapshot.source !== 'network') return;
    const localeItems = selectCatalogItems(catalogSnapshot, 'locales');
    const currencyItems = selectCatalogItems(catalogSnapshot, 'currencies');
    const defaultLocaleId = selectCatalogDefaults(catalogSnapshot, 'locales').find(
      (entry) => entry.scopeKind === 'deployment' && entry.scopeId === 'default',
    )?.entityId;
    const defaultCurrencyId = selectCatalogDefaults(catalogSnapshot, 'currencies').find(
      (entry) => entry.scopeKind === 'deployment' && entry.scopeId === 'default',
    )?.entityId;
    const nextLocale = localeItems.find((item) => item.id === settingsRef.current.localeId)
      ?? localeItems.find((item) => item.code === settingsRef.current.locale)
      ?? localeItems.find((item) => item.id === defaultLocaleId)
      ?? localeItems[0];
    const nextCurrency = currencyItems.find((item) => item.id === settingsRef.current.currencyId)
      ?? currencyItems.find((item) => item.code === settingsRef.current.currency)
      ?? currencyItems.find((item) => item.id === defaultCurrencyId)
      ?? currencyItems[0];
    const countries = selectCatalogItems(catalogSnapshot, 'countries');
    const currentCountry = countries.find((country) => country.id === settingsRef.current.countryId);
    const matchedLegacyCountry = countries.find((country) => country.code === settingsRef.current.countryCode);
    const nextCountryId = currentCountry?.id ?? matchedLegacyCountry?.id ?? null;
    const nextCountryCode = currentCountry?.code ?? matchedLegacyCountry?.code ?? settingsRef.current.countryCode;
    if (!nextLocale || !nextCurrency) return;
    if (
      nextLocale.id === settingsRef.current.localeId
      && nextLocale.code === settingsRef.current.locale
      && nextCurrency.id === settingsRef.current.currencyId
      && nextCurrency.code === settingsRef.current.currency
      && nextCountryId === settingsRef.current.countryId
      && nextCountryCode === settingsRef.current.countryCode
    ) return;
    void persist((current) => ({
      ...current,
      localeId: nextLocale.id,
      locale: nextLocale.code,
      currencyId: nextCurrency.id,
      currency: nextCurrency.code,
      countryId: nextCountryId,
      countryCode: nextCountryCode,
    }));
  }, [catalogSnapshot, persist, supportedCurrencies, supportedLocales]);

  useEffect(() => {
    if (!auth?.token || loading) return;
    let cancelled = false;
    void getLocalePreferences()
      .then((remote) => {
        if (cancelled) return;
        void persist((current) => ({
          ...current,
          localeId: remote.localeId,
          locale: remote.locale,
          currencyId: remote.currencyId,
          currency: remote.currency,
          timezone: remote.timezone,
          countryId: remote.countryId ?? null,
          countryCode: remote.countryCode ?? null,
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

  const setRegionalPreferences = useCallback((update: Partial<Pick<UserSettings, 'localeId' | 'currencyId' | 'timezone' | 'countryId'>>) => {
    const current = settingsRef.current;
    const locales = selectCatalogItems(catalogSnapshotRef.current, 'locales');
    const currencies = selectCatalogItems(catalogSnapshotRef.current, 'currencies');
    const countries = selectCatalogItems(catalogSnapshotRef.current, 'countries');
    const selectedLocale = update.localeId === undefined
      ? locales.find((item) => item.id === current.localeId)
      : locales.find((item) => item.id === update.localeId);
    const selectedCurrency = update.currencyId === undefined
      ? currencies.find((item) => item.id === current.currencyId)
      : currencies.find((item) => item.id === update.currencyId);
    const selectedCountry = update.countryId === undefined
      ? countries.find((country) => country.id === current.countryId)
      : countries.find((country) => country.id === update.countryId);
    const next = {
      ...current,
      localeId: selectedLocale?.id ?? current.localeId,
      locale: selectedLocale?.code ?? current.locale,
      currencyId: selectedCurrency?.id ?? current.currencyId,
      currency: selectedCurrency?.code ?? current.currency,
      timezone: update.timezone?.trim() || current.timezone,
      countryId: update.countryId === undefined ? current.countryId : selectedCountry?.id ?? null,
      countryCode: update.countryId === undefined ? current.countryCode : selectedCountry?.code ?? null,
    };
    void persist(next);
    if (auth?.token && catalogSnapshotRef.current.source === 'network' && selectedLocale && selectedCurrency) {
      void updateLocalePreferences({
        localeId: next.localeId,
        currencyId: next.currencyId,
        timezone: next.timezone,
        countryId: next.countryId,
      }).catch(() => undefined);
    }
  }, [auth?.token, persist]);

  const value = useMemo<UserSettingsContextValue>(() => ({
    partyId: settings.partyId,
    displayName: settings.displayName,
    localeId: settings.localeId,
    locale: settings.locale,
    currencyId: settings.currencyId,
    currency: settings.currency,
    timezone: settings.timezone,
    countryId: settings.countryId,
    countryCode: settings.countryCode,
    supportedLocales,
    supportedCurrencies,
    catalogRevision: catalogSnapshot.revision,
    catalogSource: catalogSnapshot.source,
    catalogSyncing,
    getCatalogItems,
    getCatalogDefaults,
    recordsFeed: recordsSnapshot?.feed ?? null,
    recordsRevision: recordsSnapshot?.revision ?? null,
    recordsSource: recordsSnapshot?.source ?? 'unavailable',
    refreshCatalogs,
    loading,
    setIdentity,
    clearIdentity,
    setRegionalPreferences,
  }), [
    settings,
    supportedLocales,
    supportedCurrencies,
    catalogSnapshot.revision,
    catalogSnapshot.source,
    recordsSnapshot,
    catalogSyncing,
    getCatalogItems,
    getCatalogDefaults,
    loading,
    setIdentity,
    clearIdentity,
    setRegionalPreferences,
    refreshCatalogs,
  ]);

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
