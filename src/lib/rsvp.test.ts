import { countGoingRsvps, normalizeRsvpStatus } from './rsvp';

describe('rsvp helpers', () => {
  it('normalizes backend and frontend RSVP labels', () => {
    expect(normalizeRsvpStatus('Accepted')).toBe('GOING');
    expect(normalizeRsvpStatus('GOING')).toBe('GOING');
    expect(normalizeRsvpStatus('Maybe')).toBe('INTERESTED');
    expect(normalizeRsvpStatus('NOT_GOING')).toBe('NOT_GOING');
    expect(normalizeRsvpStatus('')).toBe('NONE');
  });

  it('counts only going RSVPs as attendance', () => {
    expect(countGoingRsvps([
      { status: 'Accepted' },
      { status: 'GOING' },
      { status: 'Maybe' },
      { status: 'Declined' },
      { status: 'INTERESTED' },
      { status: 'NOT_GOING' },
    ])).toBe(2);
  });
});
