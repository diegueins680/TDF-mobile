import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const fetchNextPage = jest.fn();
const refetch = jest.fn();
const mockUseInfiniteQuery = jest.fn((_options: unknown) => ({
  data: {
    pages: [{
      items: [{
        partyId: 17,
        partyType: 'person',
        displayName: 'Ana María Ruiz',
        username: 'anaruiz',
        avatarUrl: null,
        secondaryLabel: 'Artista',
        accountStatus: 'active',
      }],
      nextCursor: 15,
    }],
  },
  isFetching: false,
  isFetchingNextPage: false,
  isError: false,
  isFetchNextPageError: false,
  hasNextPage: true,
  fetchNextPage,
  refetch,
}));

jest.mock('@tanstack/react-query', () => ({ useInfiniteQuery: (options: unknown) => mockUseInfiniteQuery(options) }));
jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: () => ({ partyId: '42', roles: ['admin'], modules: ['crm'] }),
}));

const { PartyMultiSelector, PartySelector } = require('../src/components/PartySelector') as typeof import('../src/components/PartySelector');

function MultiHarness() {
  const [value, setValue] = React.useState<import('../src/api/partySelector').PartySelectorOption[]>([]);
  return <PartyMultiSelector value={value} onChange={setValue} label="Personas invitadas" />;
}

describe('mobile PartySelector', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders human identity data and incrementally requests more results', () => {
    render(<PartySelector value={null} onChange={jest.fn()} label="Persona a invitar" />);

    expect(screen.getByText('Ana María Ruiz')).toBeTruthy();
    expect(screen.getByText('@anaruiz · Artista')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Ver más resultados' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    const options = mockUseInfiniteQuery.mock.calls[0]?.[0] as { queryKey: unknown[] };
    expect(options.queryKey).toContain('42:admin:crm');
  });

  it('never treats typed text as a selected Party', () => {
    const onChange = jest.fn();
    render(<PartySelector value={null} onChange={onChange} label="Persona a invitar" />);

    fireEvent.changeText(screen.getByLabelText('Persona a invitar'), 'Ana');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/Seleccionado:/)).toBeNull();
  });

  it('keeps multiple selections, prevents duplicate IDs, and removes each chip accessibly', () => {
    render(<MultiHarness />);

    fireEvent.press(screen.getByRole('button', { name: 'Seleccionar Ana María Ruiz' }));
    expect(screen.getAllByLabelText('Seleccionado: Ana María Ruiz')).toHaveLength(1);

    fireEvent.press(screen.getByRole('button', { name: 'Seleccionar Ana María Ruiz' }));
    expect(screen.getAllByLabelText('Seleccionado: Ana María Ruiz')).toHaveLength(1);

    fireEvent.press(screen.getByRole('button', { name: 'Quitar a Ana María Ruiz' }));
    expect(screen.queryByLabelText('Seleccionado: Ana María Ruiz')).toBeNull();
  });
});
