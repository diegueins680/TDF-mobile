import type { EventTicketTier, SocialEvent } from '../types';
import { formatCurrency, formatDateTime } from './formatters';

export const MAX_TICKETS_PER_ORDER = 100;

export const isEventTicketPurchaseEligible = (
  event: Pick<SocialEvent, 'isPublic' | 'status'>,
): boolean => Boolean(
  event.isPublic && ['announced', 'on_sale', 'live'].includes(event.status?.trim().toLowerCase() ?? ''),
);

export type TicketTierSaleState =
  | 'available'
  | 'upcoming'
  | 'sold-out'
  | 'ended'
  | 'inactive';

const parseTimestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const ticketTierAvailability = (tier: EventTicketTier): number =>
  Math.max(0, tier.quantityTotal - tier.quantitySold);

export const getTicketTierSaleState = (
  tier: EventTicketTier,
  now = Date.now(),
): TicketTierSaleState => {
  if (!tier.active) return 'inactive';

  const salesStart = parseTimestamp(tier.salesStart);
  if (salesStart !== null && now < salesStart) return 'upcoming';

  const salesEnd = parseTimestamp(tier.salesEnd);
  if (salesEnd !== null && now > salesEnd) return 'ended';

  if (ticketTierAvailability(tier) <= 0) return 'sold-out';
  return 'available';
};

export const isTicketTierOnSale = (tier: EventTicketTier, now = Date.now()): boolean =>
  getTicketTierSaleState(tier, now) === 'available';

export const ticketTierSaleStateLabel = (
  tier: EventTicketTier,
  now = Date.now(),
): string => {
  const state = getTicketTierSaleState(tier, now);
  if (state === 'available') {
    const available = ticketTierAvailability(tier);
    return available === 1 ? 'Última entrada disponible' : `${available} disponibles`;
  }
  if (state === 'upcoming') {
    const salesStart = parseTimestamp(tier.salesStart);
    if (salesStart !== null) {
      return `Venta abre ${formatTicketDateTime(new Date(salesStart))}`;
    }
    return 'Venta próximamente';
  }
  if (state === 'sold-out') return 'Agotado';
  if (state === 'ended') return 'Venta finalizada';
  return 'No disponible';
};

const deviceLocale = () => Intl.DateTimeFormat().resolvedOptions().locale || 'en';
const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const formatTicketMoney = (amountCents: number, currency: string, locale = deviceLocale()): string => {
  // locale param kept for backward compatibility; centralized formatter uses configured locale
  void locale;
  return formatCurrency(amountCents, currency);
};

export const formatTicketDateTime = (value: Date | string, locale = deviceLocale(), timezone = deviceTimezone()): string => {
  // locale/timezone params kept for backward compatibility; centralized formatter uses configured preferences
  void locale;
  void timezone;
  return formatDateTime(value, { weekday: 'short' });
};

export const getStartingTicketPrice = (
  tiers: EventTicketTier[],
  now = Date.now(),
): { amountCents: number; currency: string } | null => {
  const available = tiers.filter((tier) => isTicketTierOnSale(tier, now));
  if (available.length === 0) return null;

  const cheapest = available.reduce((current, tier) =>
    tier.priceCents < current.priceCents ? tier : current,
  );
  return { amountCents: cheapest.priceCents, currency: cheapest.currency };
};

export const isValidTicketEmail = (value: string): boolean => {
  const normalized = value.trim();
  return (
    normalized.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  );
};

export const ticketOrderStatusLabel = (status: string): string => {
  switch (status.trim().toLowerCase()) {
    case 'paid':
      return 'Confirmada';
    case 'pending':
      return 'Procesando';
    case 'cancelled':
    case 'canceled':
      return 'Cancelada';
    case 'refunded':
      return 'Reembolsada';
    default:
      return 'En revisión';
  }
};

export const ticketStatusLabel = (status: string): string => {
  switch (status.trim().toLowerCase()) {
    case 'issued':
      return 'Lista para usar';
    case 'checked_in':
    case 'checkedin':
      return 'Ya utilizada';
    case 'cancelled':
    case 'canceled':
      return 'Cancelada';
    case 'refunded':
      return 'Reembolsada';
    default:
      return 'En revisión';
  }
};
