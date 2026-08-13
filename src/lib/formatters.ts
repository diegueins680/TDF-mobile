// Centralized date, currency, and number formatters
// Mirrors the web app's src/utils/formatters.ts API

let userTimezone: string | undefined;
let userCurrency: string = 'USD';
let userLocale: string = 'es';

export function setFormatterPreferences(locale: string, timezone?: string, currency?: string) {
  userLocale = locale;
  if (timezone) userTimezone = timezone;
  if (currency) userCurrency = currency;
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(userLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: userTimezone,
    ...options,
  }).format(d);
}

export function formatDateTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  return formatDate(date, {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(userLocale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: userTimezone,
  }).format(d);
}

export function formatCurrency(amountCents: number, currency?: string): string {
  const code = currency?.toUpperCase() ?? userCurrency;
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat(userLocale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(userLocale, options).format(value);
  } catch {
    return String(value);
  }
}
