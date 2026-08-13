import {
  formatTicketMoney,
  getStartingTicketPrice,
  getTicketTierSaleState,
  isEventTicketPurchaseEligible,
  isValidTicketEmail,
  ticketOrderStatusLabel,
  ticketTierAvailability,
  ticketTierSaleStateLabel,
} from '../src/lib/tickets';
import type { EventTicketTier } from '../src/types';

const tier = (overrides: Partial<EventTicketTier> = {}): EventTicketTier => ({
  id: '1',
  eventId: '42',
  code: 'GENERAL',
  name: 'General',
  priceCents: 2500,
  currency: 'USD',
  quantityTotal: 100,
  quantitySold: 10,
  active: true,
  ...overrides,
});

describe('ticket UX helpers', () => {
  const now = Date.parse('2026-07-12T18:00:00.000Z');

  it('classifies all buyer-facing sale states without treating them as free', () => {
    expect(getTicketTierSaleState(tier(), now)).toBe('available');
    expect(getTicketTierSaleState(tier({ quantitySold: 100 }), now)).toBe('sold-out');
    expect(getTicketTierSaleState(tier({ salesStart: '2026-07-13T18:00:00.000Z' }), now)).toBe('upcoming');
    expect(getTicketTierSaleState(tier({ salesEnd: '2026-07-11T18:00:00.000Z' }), now)).toBe('ended');
    expect(getTicketTierSaleState(tier({ active: false }), now)).toBe('inactive');
  });

  it('never exposes negative availability and announces the last entry', () => {
    const last = tier({ quantityTotal: 10, quantitySold: 9 });
    expect(ticketTierAvailability(last)).toBe(1);
    expect(ticketTierSaleStateLabel(last, now)).toBe('Última entrada disponible');
    expect(ticketTierAvailability(tier({ quantityTotal: 10, quantitySold: 11 }))).toBe(0);
  });

  it('uses the cheapest currently available tier as the starting price', () => {
    expect(getStartingTicketPrice([
      tier({ id: 'vip', priceCents: 8000 }),
      tier({ id: 'sold', priceCents: 1000, quantitySold: 100 }),
      tier({ id: 'general', priceCents: 2500 }),
    ], now)).toEqual({ amountCents: 2500, currency: 'USD' });
  });

  it('formats money and validates delivery emails for the checkout', () => {
    expect(formatTicketMoney(2500, 'usd')).toMatch(/25[,.]00|25/);
    expect(isValidTicketEmail('fan+ticket@example.com')).toBe(true);
    expect(isValidTicketEmail('fan@example')).toBe(false);
    expect(isValidTicketEmail('')).toBe(false);
  });

  it('localizes raw order statuses', () => {
    expect(ticketOrderStatusLabel('paid')).toBe('Confirmada');
    expect(ticketOrderStatusLabel('pending')).toBe('Procesando');
    expect(ticketOrderStatusLabel('refunded')).toBe('Reembolsada');
  });

  it('uses one purchase-eligibility policy across ticket surfaces', () => {
    expect(isEventTicketPurchaseEligible({ isPublic: true, ticketPurchaseEnabled: true })).toBe(true);
    expect(isEventTicketPurchaseEligible({ isPublic: true, ticketPurchaseEnabled: false })).toBe(false);
    expect(isEventTicketPurchaseEligible({ isPublic: false, ticketPurchaseEnabled: true })).toBe(false);
  });
});
