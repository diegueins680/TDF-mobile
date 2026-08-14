import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import Parties from '../app/(tabs)/parties';

const mockRefetch = jest.fn();
const mockMutate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
    isFetching: false,
  })),
  useMutation: jest.fn(() => ({
    mutate: mockMutate,
    isPending: false,
  })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({ token: 'Bearer demo', loading: false })),
}));

describe('Parties tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows retry when query fails with token', () => {
    const useQuery = require('@tanstack/react-query').useQuery as jest.Mock;
    useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('Boom'),
      refetch: mockRefetch,
      isFetching: false,
    });

    render(<Parties />);

    expect(screen.getByText(/Boom/)).toBeTruthy();
    const retry = screen.getByText(/Reintentar/);
    fireEvent.press(retry);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('links to Auth when no token', () => {
    jest.mocked(require('../src/providers/AuthProvider').useAuth).mockReturnValue({
      token: null,
      loading: false,
    });
    const useQuery = require('@tanstack/react-query').useQuery as jest.Mock;
    useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('No token'),
      refetch: mockRefetch,
      isFetching: false,
    });

    render(<Parties />);

    expect(screen.getByText(/Inicia sesión para cargar y crear clientes/i)).toBeTruthy();
    const [authBtn] = screen.getAllByText(/Abrir login/i);
    fireEvent.press(authBtn);
    expect(mockPush).toHaveBeenCalledWith('/auth');
  });
});
