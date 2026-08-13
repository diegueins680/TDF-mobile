import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getPublicServiceOfferingCatalog,
  type ServiceCatalogEnvelopeDTO,
  type ServiceOfferingDTO,
} from '../api/services';

const STORAGE_KEY = 'tdf-service-catalog-snapshot-v2';
const SNAPSHOT_SCHEMA_VERSION = 2;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_RESOURCE_ID_PATTERN = /^[1-9][0-9]*$/;

export interface StoredServiceCatalogSnapshot extends ServiceCatalogEnvelopeDTO {
  syncedAt: string;
}

const isDefaultResource = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ServiceOfferingDTO['scDefaultResources'][number]>;
  return typeof candidate.sdrResourceId === 'string'
    && POSITIVE_RESOURCE_ID_PATTERN.test(candidate.sdrResourceId)
    && typeof candidate.sdrResourceName === 'string'
    && typeof candidate.sdrSelectionModeId === 'string'
    && UUID_PATTERN.test(candidate.sdrSelectionModeId)
    && (candidate.sdrSelectionMode === 'all' || candidate.sdrSelectionMode === 'first-available')
    && Number.isSafeInteger(candidate.sdrSortOrder)
    && (candidate.sdrSortOrder ?? -1) >= 0;
};

const isServiceOffering = (value: unknown): value is ServiceOfferingDTO => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ServiceOfferingDTO>;
  return typeof candidate.scId === 'string'
    && UUID_PATTERN.test(candidate.scId)
    && typeof candidate.scCode === 'string'
    && typeof candidate.scName === 'string'
    && typeof candidate.scCategoryId === 'string'
    && UUID_PATTERN.test(candidate.scCategoryId)
    && typeof candidate.scPricingModelId === 'string'
    && UUID_PATTERN.test(candidate.scPricingModelId)
    && typeof candidate.scCurrencyId === 'string'
    && UUID_PATTERN.test(candidate.scCurrencyId)
    && candidate.scActive === true
    && Array.isArray(candidate.scDefaultResources)
    && candidate.scDefaultResources.every(isDefaultResource);
};

const isEnvelope = (value: unknown, locale: string): value is ServiceCatalogEnvelopeDTO => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ServiceCatalogEnvelopeDTO>;
  return candidate.sceSchemaVersion === SNAPSHOT_SCHEMA_VERSION
    && Number.isSafeInteger(candidate.sceRevision)
    && (candidate.sceRevision ?? -1) >= 0
    && candidate.sceLocale === locale
    && Array.isArray(candidate.sceItems)
    && candidate.sceItems.every(isServiceOffering);
};

export const parseServiceCatalogSnapshot = (
  raw: string | null,
  locale: string,
): StoredServiceCatalogSnapshot | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isEnvelope(parsed, locale)) return null;
    const syncedAt = (parsed as Partial<StoredServiceCatalogSnapshot>).syncedAt;
    if (typeof syncedAt !== 'string' || Number.isNaN(Date.parse(syncedAt))) return null;
    return parsed as StoredServiceCatalogSnapshot;
  } catch {
    return null;
  }
};

const storageKeyForLocale = (locale: string): string => `${STORAGE_KEY}:${locale}`;

export const loadServiceOfferingSnapshot = async (locale = 'es'): Promise<ServiceOfferingDTO[]> => {
  const normalizedLocale = locale.toLowerCase().startsWith('en') ? 'en' : 'es';
  const storageKey = storageKeyForLocale(normalizedLocale);
  let cached: StoredServiceCatalogSnapshot | null = null;
  try {
    cached = parseServiceCatalogSnapshot(await AsyncStorage.getItem(storageKey), normalizedLocale);
  } catch {
    cached = null;
  }
  try {
    const remote = await getPublicServiceOfferingCatalog(normalizedLocale);
    if (!isEnvelope(remote, normalizedLocale)) return cached?.sceItems ?? [];
    const snapshot: StoredServiceCatalogSnapshot = {
      ...remote,
      sceItems: [...remote.sceItems].sort(
        (left, right) => left.scSortOrder - right.scSortOrder || left.scName.localeCompare(right.scName),
      ),
      syncedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(storageKey, JSON.stringify(snapshot));
    return snapshot.sceItems;
  } catch {
    return cached?.sceItems ?? [];
  }
};
