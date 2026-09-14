const DEFAULT_WEB_CHECKOUT_BASE = 'https://tdf-app.pages.dev';

const safePositiveInteger = (value: string | number, field: string): string => {
  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return String(normalized);
};

const checkoutBase = (configuredBase: string | undefined): URL => {
  const rawBase = configuredBase?.trim() || DEFAULT_WEB_CHECKOUT_BASE;
  const parsed = new URL(rawBase);
  const localDevelopment = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(localDevelopment && parsed.protocol === 'http:')) {
    throw new Error('Secure web checkout URL is invalid.');
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed;
};

export function buildProviderNeutralTicketCheckoutUrl(
  eventId: string | number,
  tierId: string | number,
  quantity: number,
  configuredBase = process.env.EXPO_PUBLIC_WEB_CHECKOUT_BASE_URL,
): string {
  const base = checkoutBase(configuredBase);
  const event = safePositiveInteger(eventId, 'eventId');
  const tier = safePositiveInteger(tierId, 'tierId');
  const count = safePositiveInteger(quantity, 'quantity');
  const checkout = new URL(`${base.toString().replace(/\/$/, '')}/eventos/${event}/entradas`);
  checkout.searchParams.set('tierId', tier);
  checkout.searchParams.set('quantity', count);
  checkout.searchParams.set('source', 'mobile');
  return checkout.toString();
}

export const providerNeutralCheckoutDefaults = {
  webBase: DEFAULT_WEB_CHECKOUT_BASE,
} as const;
