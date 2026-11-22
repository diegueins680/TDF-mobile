import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import DirectoryScreen from '../app/(tabs)/directory';
import { Directory } from '../src/api/directory';
import { Taxonomy } from '../src/api/taxonomy';
import {
  getSharedTaxonomySelection,
  resetSharedTaxonomyStateForTests,
} from '../src/features/taxonomyFilters/taxonomyFilterStore';

const EC = '11111111-1111-4111-8111-111111111111';
const QUITO = '44444444-4444-4444-8444-444444444444';
const GUAYAQUIL = '55555555-5555-4555-8555-555555555555';
const ROCK = '66666666-6666-4666-8666-666666666666';
const INDIE = '77777777-7777-4777-8777-777777777777';

let mockRouteParams: Record<string, string | string[]> = {};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockRouteParams,
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  PermissionStatus: { GRANTED: 'granted' },
  Accuracy: { Balanced: 3 },
}));

jest.mock('../src/api/directory', () => ({
  Directory: { search: jest.fn(), taxonomies: jest.fn(), saveSearch: jest.fn() },
}));

jest.mock('../src/api/taxonomy', () => ({ Taxonomy: { filterOptions: jest.fn() } }));

jest.mock('../src/analytics/AnalyticsProvider', () => ({ useAnalytics: () => ({ capture: jest.fn() }) }));
jest.mock('../src/providers/AuthProvider', () => ({ useAuth: () => ({ token: null }) }));
jest.mock('../src/providers/UserSettingsProvider', () => ({ useUserSettings: () => ({ locale: 'es' }) }));
jest.mock('../src/theme/ThemeProvider', () => ({
  useAppTheme: () => ({ colors: {
    canvas: '#fff', surfaceRaised: '#fff', surface: '#fff', selected: '#eee', infoSurface: '#eef',
    textPrimary: '#111', textSecondary: '#555', actionPrimary: '#6200ee', actionPrimaryContrast: '#fff',
    border: '#999', borderSubtle: '#ddd', infoBorder: '#99f', danger: '#b91c1c',
    warningBorder: '#fa0', warningSurface: '#ffe', success: '#0a0',
  } }),
}));

const searchMock = Directory.search as jest.Mock;

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <DirectoryScreen />
    </QueryClientProvider>,
  );
};

const lastSearch = () => searchMock.mock.calls[searchMock.mock.calls.length - 1]?.[0];

describe('Directory taxonomy filters', () => {
  beforeEach(async () => {
    mockRouteParams = {};
    await AsyncStorage.clear();
    resetSharedTaxonomyStateForTests();
    searchMock.mockReset();
    searchMock.mockResolvedValue({
      items: [],
      sponsoredItems: [],
      nextCursor: null,
      facets: { entityTypes: {}, cities: [], total: 0, taxonomy: { genres: [{ id: ROCK, count: 12 }, { id: INDIE, count: 3 }], countries: [], regions: [], cities: [] } },
    });
    (Directory.taxonomies as jest.Mock).mockResolvedValue({
      locale: 'es', professions: [], classifiedCategories: [], compensationTypes: [], serviceOfferings: [],
      currencies: [], instruments: [], genres: [], languages: [], cities: [],
    });
    (Taxonomy.filterOptions as jest.Mock).mockResolvedValue({
      countries: [{ id: EC, code: 'EC', nameEs: 'Ecuador', nameEn: 'Ecuador' }],
      regions: [],
      cities: [
        { id: QUITO, countryId: EC, regionId: null, code: 'quito-ec-p', nameEs: 'Quito', nameEn: 'Quito' },
        { id: GUAYAQUIL, countryId: EC, regionId: null, code: 'guayaquil-ec-g', nameEs: 'Guayaquil', nameEn: 'Guayaquil' },
      ],
      genres: [
        { id: ROCK, parentId: null, code: 'rock', nameEs: 'Rock', nameEn: 'Rock' },
        { id: INDIE, parentId: ROCK, code: 'indie', nameEs: 'Rock independiente', nameEn: 'Indie rock' },
      ],
    });
  });

  it('starts the shared filters on the last directory city once and searches with it', async () => {
    await AsyncStorage.setItem('tdf-mobile/directory-city-id', GUAYAQUIL);
    renderScreen();

    await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ cityIds: [GUAYAQUIL] })));
    expect(getSharedTaxonomySelection().cityIds).toEqual([GUAYAQUIL]);
    expect(await screen.findByRole('button', { name: 'Quitar Guayaquil' })).toBeTruthy();
  });

  it('imposes no city on a viewer who never chose one, and sends chosen genres with their counts shown', async () => {
    renderScreen();
    await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ cityIds: [] })));
    expect(getSharedTaxonomySelection().cityIds).toEqual([]);

    fireEvent.press(await screen.findByRole('button', { name: 'Filtrar por lugar y género' }));
    fireEvent.press(screen.getByRole('button', { name: 'Género' }));
    fireEvent.press(screen.getByRole('checkbox', { name: 'Rock independiente, 3 resultados' }));

    await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ cityIds: [], genreIds: [INDIE] })));
    expect(getSharedTaxonomySelection().genreIds).toEqual([INDIE]);
    expect(screen.getByRole('checkbox', { name: 'Rock, 12 resultados' })).toBeTruthy();

    fireEvent.press(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0]!);
    await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ cityIds: [], genreIds: [] })));
  });

  it('opens a deep link with its own filters and can go back to the shared ones', async () => {
    mockRouteParams = { 'f.genre': [ROCK], 'f.scope': 'local' };
    renderScreen();

    await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ genreIds: [ROCK], cityIds: [] })));
    expect(screen.getByText('Esta sección usa sus propios filtros.')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Usar los filtros generales' }));
    await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ genreIds: [], cityIds: [] })));
    expect(screen.queryByText('Esta sección usa sus propios filtros.')).toBeNull();
  });
});
