import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ArtistDetailScreen from '../app/artistDetail';

const mockFollow = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ artistId: '7' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({ partyId: '42' })),
}));

jest.mock('../src/api/artists', () => ({
  Artists: {
    follow: (...args: unknown[]) => mockFollow(...args),
    unfollow: jest.fn(),
    listFollowers: jest.fn(),
  },
}));

describe('ArtistDetail screen', () => {
  const useQuery = jest.mocked(require('@tanstack/react-query').useQuery as jest.Mock);

  beforeEach(() => {
    jest.clearAllMocks();
    mockFollow.mockResolvedValue({});

    useQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'artist') {
        return {
          data: {
            id: '7',
            partyId: '7',
            name: 'Demo Artist',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          isLoading: false,
          isError: false,
        };
      }

      if (queryKey[0] === 'artist-events') {
        return {
          data: [],
          isLoading: false,
          isError: false,
        };
      }

      if (queryKey[0] === 'artist-followers') {
        return {
          data: [],
          isLoading: false,
          isError: false,
        };
      }

      return {
        data: undefined,
        isLoading: false,
        isError: false,
      };
    });
  });

  it('uses the authenticated party id for follow actions', async () => {
    render(<ArtistDetailScreen />);

    fireEvent.press(screen.getByText('Seguir'));

    await waitFor(() => expect(mockFollow).toHaveBeenCalledWith('7', '42'));
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['artist-followers', '7'] });
  });
});
