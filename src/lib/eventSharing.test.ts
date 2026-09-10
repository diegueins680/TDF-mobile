import { canonicalEventPath, canonicalEventUrl, eventShareMessage } from './eventSharing';

describe('event sharing', () => {
  it('uses only the canonical public event route and allow-listed attribution', () => {
    expect(canonicalEventPath(' 42 ')).toBe('/eventos/42');
    expect(canonicalEventUrl('42', {
      utm_source: 'tdf_mobile', utm_medium: 'share', utm_campaign: 'event_rsvp', partyId: '7', token: 'secret',
    })).toBe('https://tdf-app.pages.dev/eventos/42?utm_source=tdf_mobile&utm_medium=share&utm_campaign=event_rsvp');
    expect(() => canonicalEventPath('../social/eventos/42')).toThrow('Invalid public event identifier');
  });

  it('localizes RSVP copy without identity data', () => {
    expect(eventShareMessage({ title: 'Festival TDF', status: 'GOING', locale: 'es-EC' }))
      .toBe('Voy a Festival TDF. ¿Nos vemos ahí?');
    expect(eventShareMessage({ title: 'Festival TDF', status: 'INTERESTED', locale: 'en-US' }))
      .toBe("I'm interested in Festival TDF. Take a look.");
  });
});

