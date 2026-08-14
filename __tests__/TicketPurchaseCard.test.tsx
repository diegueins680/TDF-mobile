import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { TicketPurchaseCard } from '../src/components/tickets/TicketPurchaseCard';
import type { EventTicketTier } from '../src/types';
import { renderWithTheme } from '../test/renderWithTheme';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

const tier = (overrides: Partial<EventTicketTier> = {}): EventTicketTier => ({
  id: '1',
  eventId: '42',
  code: 'GENERAL',
  name: 'General',
  priceCents: 2500,
  currency: 'USD',
  quantityTotal: 20,
  quantitySold: 4,
  active: true,
  ...overrides,
});

const callbacks = () => ({
  onBuy: jest.fn(),
  onOpenExternal: jest.fn(),
  onRetry: jest.fn(),
});

describe('TicketPurchaseCard', () => {
  it('puts the internal purchase action above event details', () => {
    const handlers = callbacks();
    renderWithTheme(<TicketPurchaseCard tiers={[tier()]} {...handlers} />);

    fireEvent.press(screen.getByRole('button', { name: 'Comprar entradas' }));
    expect(handlers.onBuy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('16 disponibles')).toBeTruthy();
  });

  it('labels an explicit zero-priced tier as free', () => {
    renderWithTheme(<TicketPurchaseCard tiers={[tier({ priceCents: 0 })]} {...callbacks()} />);

    expect(screen.getByText('Gratis')).toBeTruthy();
    expect(screen.getByText('Obtener entradas')).toBeTruthy();
  });

  it('distinguishes upcoming sales from sold out inventory', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const { rerender } = renderWithTheme(
      <TicketPurchaseCard tiers={[tier({ salesStart: tomorrow })]} {...callbacks()} />,
    );
    expect(screen.getByText('Venta próximamente')).toBeTruthy();

    rerender(<TicketPurchaseCard tiers={[tier({ quantitySold: 20 })]} {...callbacks()} />);
    expect(screen.getByText('Entradas agotadas')).toBeTruthy();
  });

  it('offers retry for an availability error instead of claiming no tickets', () => {
    const handlers = callbacks();
    renderWithTheme(<TicketPurchaseCard tiers={[]} isError {...handlers} />);

    fireEvent.press(screen.getByText('Reintentar'));
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Venta no disponible')).toBeNull();
  });

  it('uses the external provider only when no internal tier is on sale', () => {
    const handlers = callbacks();
    renderWithTheme(
      <TicketPurchaseCard
        tiers={[]}
        externalTicketUrl="https://tickets.example.com"
        fallbackPrice={30}
        {...handlers}
      />,
    );

    fireEvent.press(screen.getByText('Ir a la venta'));
    expect(handlers.onOpenExternal).toHaveBeenCalledTimes(1);
  });

  it('does not offer an internal checkout when the event itself is not eligible', () => {
    renderWithTheme(<TicketPurchaseCard tiers={[tier()]} canBuyInternally={false} {...callbacks()} />);

    expect(screen.queryByRole('button', { name: 'Comprar entradas' })).toBeNull();
    expect(screen.getByText('Venta no disponible')).toBeTruthy();
  });
});
