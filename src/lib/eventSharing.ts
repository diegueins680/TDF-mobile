import type { RSVPStatus } from '../types';

export const PUBLIC_EVENT_ORIGIN = 'https://tdf-app.pages.dev';
const EVENT_ID = /^[1-9]\d{0,18}$/;
const ALLOWED_ATTRIBUTION: Record<string, ReadonlySet<string>> = {
  utm_source: new Set(['tdf_mobile']),
  utm_medium: new Set(['share', 'copy', 'whatsapp']),
  utm_campaign: new Set(['event_rsvp']),
};

export function canonicalEventPath(eventId: string): `/eventos/${string}` {
  const normalized = eventId.trim();
  if (!EVENT_ID.test(normalized)) throw new Error('Invalid public event identifier.');
  return `/eventos/${normalized}`;
}

export function canonicalEventUrl(
  eventId: string,
  attribution?: Record<string, string | null | undefined>,
): string {
  const url = new URL(canonicalEventPath(eventId), PUBLIC_EVENT_ORIGIN);
  Object.entries(attribution ?? {}).forEach(([key, rawValue]) => {
    const value = rawValue?.trim();
    if (value && ALLOWED_ATTRIBUTION[key]?.has(value)) url.searchParams.set(key, value);
  });
  return url.toString();
}

export function eventShareMessage(input: {
  title: string;
  status?: Extract<RSVPStatus, 'GOING' | 'INTERESTED'> | null;
  start?: string | null;
  timezone?: string | null;
  venue?: string | null;
  locale?: string | null;
}): string {
  const english = input.locale?.toLowerCase().startsWith('en') ?? false;
  const when = formatDate(input.start, input.locale, input.timezone);
  const details = [when, input.venue?.trim()].filter(Boolean).join(english ? ' at ' : ' en ');
  const suffix = details ? ` ${english ? 'on' : 'el'} ${details}` : '';
  if (input.status === 'GOING') {
    return english ? `I'm going to ${input.title}${suffix}. See you there?` : `Voy a ${input.title}${suffix}. ¿Nos vemos ahí?`;
  }
  if (input.status === 'INTERESTED') {
    return english ? `I'm interested in ${input.title}${suffix}. Take a look.` : `Me interesa ${input.title}${suffix}. Mira los detalles.`;
  }
  return english ? `${input.title}${suffix}. View the event details.` : `${input.title}${suffix}. Mira los detalles del evento.`;
}

function formatDate(value?: string | null, locale?: string | null, timezone?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  try {
    return parsed.toLocaleString(locale || 'es', {
      dateStyle: 'medium', timeStyle: 'short', ...(timezone ? { timeZone: timezone } : {}),
    });
  } catch {
    return parsed.toLocaleString(locale || 'es', { dateStyle: 'medium', timeStyle: 'short' });
  }
}
