import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import CreateEventScreen from '../app/createEvent';
import { renderWithTheme } from '../test/renderWithTheme';

const mockMutate = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(() => ({ mutate: mockMutate, isPending: false })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
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
  useUserSettings: () => ({ currency: 'USD' }),
}));

describe('CreateEvent screen', () => {
  const useQuery = jest.mocked(require('@tanstack/react-query').useQuery as jest.Mock);

  beforeEach(() => {
    jest.clearAllMocks();

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

  it('blocks negative ticket prices before submitting the mutation', () => {
    renderWithTheme(<CreateEventScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Nombre del evento'), 'Demo Event');
    fireEvent.press(screen.getByText('Selecciona un lugar'));
    fireEvent.press(screen.getByText('Main Room'));
    fireEvent.press(screen.getByText('Selecciona artistas'));
    fireEvent.press(screen.getByText('DJ Uno'));
    fireEvent.press(screen.getByText('Listo'));
    fireEvent.changeText(screen.getByPlaceholderText('0.00'), '-5');
    fireEvent.press(screen.getByText('Crear evento'));

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('El precio de entrada debe ser cero o mayor')).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
