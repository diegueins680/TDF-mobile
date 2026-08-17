import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import CreateEventScreen from '../app/createEvent';

const mockMutate = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockRefreshCatalogs = jest.fn();
const mockGetCatalogItems = jest.fn();
const mockGetCatalogDefaults = jest.fn();
let mockCatalogSource: 'network' | 'emergency' = 'network';
let mockCatalogSyncing = false;
const EVENT_TYPE_ID = '41000000-0000-4000-8000-000000000001';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(() => ({ mutate: mockMutate, isPending: false })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('../src/api/events', () => ({
  Events: {
    create: jest.fn(),
  },
}));

jest.mock('../src/api/venues', () => ({
  Venues: {
    list: jest.fn(),
    search: jest.fn(),
    getById: jest.fn(),
  },
}));

jest.mock('../src/api/artists', () => ({
  Artists: {
    list: jest.fn(),
    searchByName: jest.fn(),
  },
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({
    currency: 'USD',
    catalogSource: mockCatalogSource,
    catalogSyncing: mockCatalogSyncing,
    getCatalogItems: mockGetCatalogItems,
    getCatalogDefaults: mockGetCatalogDefaults,
    refreshCatalogs: mockRefreshCatalogs,
  }),
}));

describe('CreateEvent screen', () => {
  const useQuery = jest.mocked(require('@tanstack/react-query').useQuery as jest.Mock);
  let alertSpy: jest.SpiedFunction<typeof Alert.alert>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCatalogSource = 'network';
    mockCatalogSyncing = false;
    mockGetCatalogItems.mockImplementation((code: string) => code === 'event-types' ? [{
      id: EVENT_TYPE_ID,
      code: 'party',
      name: 'Fiesta',
      active: true,
      workflowState: 'published',
    }] : []);
    mockGetCatalogDefaults.mockImplementation((code: string) => code === 'event-types' ? [{
      entityId: EVENT_TYPE_ID,
      scopeKind: 'social-event',
      scopeId: 'global',
    }] : []);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    useQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'venues') {
        return {
          data: [
            {
              id: 12,
              name: 'Main Room',
              city: 'Quito',
            },
          ],
          isLoading: false,
        };
      }

      if (queryKey[0] === 'artists') {
        return {
          data: [
            {
              id: 7,
              name: 'DJ Uno',
              genres: ['House'],
            },
          ],
          isLoading: false,
        };
      }

      return {
        data: null,
        isLoading: false,
      };
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('blocks negative ticket prices before submitting the mutation', () => {
    render(<CreateEventScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Nombre del evento'), 'Demo Event');
    fireEvent.press(screen.getByText('Selecciona un lugar'));
    fireEvent.press(screen.getByText('Main Room'));
    fireEvent.press(screen.getByText('Selecciona artistas'));
    fireEvent.press(screen.getByText('DJ Uno'));
    fireEvent.press(screen.getByText('Listo'));
    fireEvent.changeText(screen.getByPlaceholderText('0.00'), '-5');
    fireEvent.press(screen.getByText('Crear evento'));

    expect(Alert.alert).toHaveBeenCalledWith('Validación', 'El precio de entrada debe ser cero o mayor');
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('submits the persisted event type UUID selected from the catalog', () => {
    render(<CreateEventScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Nombre del evento'), 'Demo Event');
    fireEvent.press(screen.getByText('Selecciona un lugar'));
    fireEvent.press(screen.getByText('Main Room'));
    fireEvent.press(screen.getByText('Selecciona artistas'));
    fireEvent.press(screen.getByText('DJ Uno'));
    fireEvent.press(screen.getByText('Listo'));
    fireEvent.press(screen.getByText('Crear evento'));

    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
      eventTypeId: EVENT_TYPE_ID,
      title: 'Demo Event',
    }));
  });

  it('submits null instead of inventing a duration when the end is unconfirmed', () => {
    render(<CreateEventScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Nombre del evento'), 'Evento sin fin oficial');
    fireEvent.press(screen.getByText('Fin por confirmar'));
    fireEvent.press(screen.getByText('Selecciona un lugar'));
    fireEvent.press(screen.getByText('Main Room'));
    fireEvent.press(screen.getByText('Selecciona artistas'));
    fireEvent.press(screen.getByText('DJ Uno'));
    fireEvent.press(screen.getByText('Listo'));
    fireEvent.press(screen.getByText('Crear evento'));

    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
      endTime: null,
      title: 'Evento sin fin oficial',
    }));
  });

  it('preserves the form and offers synchronization when only emergency catalogs exist', () => {
    mockCatalogSource = 'emergency';
    mockGetCatalogItems.mockReturnValue([]);
    mockGetCatalogDefaults.mockReturnValue([]);
    render(<CreateEventScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Nombre del evento'), 'Borrador sin conexión');

    expect(screen.getByDisplayValue('Borrador sin conexión')).toBeTruthy();
    expect(screen.getByText('No hay tipos de evento publicados disponibles. Tu borrador se conservará.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear evento' }).props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(screen.getByRole('button', { name: 'Volver a sincronizar tipos de evento' }));
    expect(mockRefreshCatalogs).toHaveBeenCalledTimes(1);
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
