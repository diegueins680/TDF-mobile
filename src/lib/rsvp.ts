import type { RSVPStatus } from '../types';

export function normalizeRsvpStatus(raw: unknown): RSVPStatus {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'accepted' || normalized === 'going' || normalized === 'yes') return 'GOING';
  if (normalized === 'maybe' || normalized === 'interested') return 'INTERESTED';
  if (normalized === 'declined' || normalized === 'not_going' || normalized === 'not-going' || normalized === 'no') {
    return 'NOT_GOING';
  }
  return 'NONE';
}

export function countGoingRsvps(entries: Array<{ status: unknown }> | null | undefined): number {
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((count, entry) => (
    normalizeRsvpStatus(entry.status) === 'GOING' ? count + 1 : count
  ), 0);
}
