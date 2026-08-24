import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import DirectoryManageScreen from '../app/directory/manage';

let mockCreateParam: string | string[] | undefined = 'classified';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'directory-managed-profiles') {
      return { data: [{
        id: 'profile-1', name: 'Perfil de prueba', kind: 'person', status: 'published', slug: 'perfil-de-prueba',
        professionIds: [], serviceAreas: [], capabilities: { edit: true, publish: true },
      }], isLoading: false };
    }
    if (queryKey[0] === 'directory-taxonomies') {
      return {
        data: {
          cities: [], classifiedCategories: [], compensationTypes: [], currencies: [], genres: [],
          instruments: [], professions: [], serviceOfferings: [],
        },
        isLoading: false,
      };
    }
    return { data: [], isLoading: false };
  }),
  useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ create: mockCreateParam }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('../src/api/directory', () => ({
  Directory: {
    managedProfiles: jest.fn(), managedClassifieds: jest.fn(), invitations: jest.fn(), taxonomies: jest.fn(),
    setAgeAssurance: jest.fn(), transitionProfile: jest.fn(), transitionClassified: jest.fn(),
  },
}));

jest.mock('../src/theme/ThemeProvider', () => ({
  useAppTheme: () => ({ colors: {
    canvas: '#fff', surfaceRaised: '#fff', surface: '#fff', selected: '#eee', infoSurface: '#eef',
    textPrimary: '#111', textSecondary: '#555', actionPrimary: '#6200ee', actionPrimaryContrast: '#fff',
    border: '#999', borderSubtle: '#ddd', infoBorder: '#99f', danger: '#b91c1c',
  } }),
}));

describe('Directory manage screen', () => {
  beforeEach(() => {
    mockCreateParam = 'classified';
  });

  it('opens the classified form from the quick-create route', async () => {
    render(<DirectoryManageScreen />);

    await waitFor(() => expect(screen.getByLabelText('Título del anuncio')).toBeTruthy());
    expect(screen.getByText('Cerrar formulario')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Anuncios (0)' }).props.accessibilityState).toEqual({ selected: true });
  });
});
