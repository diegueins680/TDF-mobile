import { parseServiceCatalogSnapshot } from './serviceCatalogSnapshot';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const validSnapshot = {
  sceSchemaVersion: 2,
  sceRevision: 42,
  sceLocale: 'es',
  syncedAt: '2026-08-07T12:00:00.000Z',
  sceItems: [
    {
      scId: '11111111-1111-4111-8111-111111111111',
      scCode: 'studio-recording',
      scName: 'Grabación de estudio',
      scNameEs: 'Grabación de estudio',
      scNameEn: 'Studio recording',
      scCategoryId: '22222222-2222-4222-8222-222222222222',
      scKind: 'recording',
      scPricingModelId: '33333333-3333-4333-8333-333333333333',
      scPricingModel: 'hourly',
      scRateCents: 12000,
      scCurrency: 'USD',
      scCurrencyId: '44444444-4444-4444-8444-444444444444',
      scDefaultDurationMinutes: 120,
      scRequiresEngineer: true,
      scDefaultResources: [{
        sdrResourceId: '12',
        sdrResourceName: 'Control Room',
        sdrSelectionModeId: '55555555-5555-4555-8555-555555555555',
        sdrSelectionMode: 'all' as const,
        sdrSortOrder: 10,
      }],
      scSortOrder: 10,
      scActive: true,
    },
  ],
};

describe('parseServiceCatalogSnapshot', () => {
  it('accepts a locale-aware, revisioned last-known-good snapshot', () => {
    expect(parseServiceCatalogSnapshot(JSON.stringify(validSnapshot), 'es')).toEqual(validSnapshot);
  });

  it('rejects incompatible schema versions and locale cross-contamination', () => {
    expect(parseServiceCatalogSnapshot(JSON.stringify({ ...validSnapshot, sceSchemaVersion: 1 }), 'es')).toBeNull();
    expect(parseServiceCatalogSnapshot(JSON.stringify(validSnapshot), 'en')).toBeNull();
  });

  it('rejects copied or malformed identifiers before offline form use', () => {
    const malformed = {
      ...validSnapshot,
      sceItems: [{ ...validSnapshot.sceItems[0], scPricingModelId: 'hourly' }],
    };
    expect(parseServiceCatalogSnapshot(JSON.stringify(malformed), 'es')).toBeNull();
    const copiedPolicyCode = {
      ...validSnapshot,
      sceItems: [{
        ...validSnapshot.sceItems[0],
        scDefaultResources: [{
          ...validSnapshot.sceItems[0].scDefaultResources[0],
          sdrSelectionModeId: 'all',
        }],
      }],
    };
    expect(parseServiceCatalogSnapshot(JSON.stringify(copiedPolicyCode), 'es')).toBeNull();
  });
});
