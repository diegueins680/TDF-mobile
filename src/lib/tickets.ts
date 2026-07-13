import type { EventTicketTier, SocialEvent } from '../types';

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

export const formatTicketMoney = (amountCents: number, currency: string): string => {
  const safeAmount = Number.isFinite(amountCents) ? amountCents : 0;
  const normalizedCurrency = currency.trim().toUpperCase() || 'USD';

  try {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
    }).format(safeAmount / 100);
  } catch {
    return `${normalizedCurrency} ${(safeAmount / 100).toFixed(2)}`;
  }
};

export const formatTicketDateTime = (value: Date | string): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('es-EC', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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
