import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import CreateEventScreen from '../app/createEvent';

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

describe('CreateEvent screen', () => {
  const useQuery = jest.mocked(require('@tanstack/react-query').useQuery as jest.Mock);
  let alertSpy: jest.SpiedFunction<typeof Alert.alert>;

  beforeEach(() => {
    jest.clearAllMocks();
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

    fireEvent.changeText(screen.getByPlaceholderText('Event name'), 'Demo Event');
    fireEvent.press(screen.getByText('Select a venue'));
    fireEvent.press(screen.getByText('Main Room'));
    fireEvent.press(screen.getByText('Select artists'));
    fireEvent.press(screen.getByText('DJ Uno'));
    fireEvent.press(screen.getByText('Done'));
    fireEvent.changeText(screen.getByPlaceholderText('0.00'), '-5');
    fireEvent.press(screen.getByText('Create Event'));

    expect(Alert.alert).toHaveBeenCalledWith('Validation', 'Ticket price must be zero or greater');
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
