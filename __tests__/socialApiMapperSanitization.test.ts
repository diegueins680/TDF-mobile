jest.mock('../src/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  del: jest.fn(),
}));

import { Artists } from '../src/api/artists';
import { Events } from '../src/api/events';
import { Venues } from '../src/api/venues';

const { get, post } = jest.requireMock('../src/api/client') as {
  get: jest.Mock;
  post: jest.Mock;
};
const ISO_TIMESTAMP_PREFIX = /^\d{4}-\d{2}-\d{2}T/;

describe('Social API mapper sanitization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Artists.list uses party id fallback when artist id is missing', async () => {
    get.mockResolvedValueOnce([
      {
        artistPartyId: '55',
        partyId: '55',
        artistName: 'Fallback Artist',
      },
    ]);

    const artists = await Artists.list();

    expect(artists).toHaveLength(1);
    expect(artists[0]?.id).toBe(55);
    expect(artists[0]?.partyId).toBe(55);
  });

  it('Artists.create removes null and blank social links from payload', async () => {
    post.mockResolvedValueOnce({
      artistId: 9,
      artistPartyId: 55,
      artistName: 'Sanitized Artist',
      artistSocialLinks: {
        instagram: '@artist',
        spotify: 'https://open.spotify.com/artist/abc',
      },
    });

    await Artists.create({
      partyId: 55,
      name: 'Sanitized Artist',
      instagramHandle: ' @artist ',
      socialLinks: {
        spotify: ' https://open.spotify.com/artist/abc ',
        twitter: null,
        youtube: '   ',
      },
    });

    expect(post).toHaveBeenCalledWith(
      '/social-events/artists',
      expect.objectContaining({
        artistSocialLinks: {
          instagram: '@artist',
          spotify: 'https://open.spotify.com/artist/abc',
        },
      }),
    );
  });

  it('Artists.list preserves oversized digit ids and falls back on invalid numeric ids', async () => {
    get.mockResolvedValueOnce([
      {
        artistId: '90071992547409931234',
        artistPartyId: '55',
        artistName: 'Big Numeric String Artist',
      },
      {
        artistId: -9,
        artistPartyId: 44,
        artistName: 'Fallback Artist',
      },
    ]);

    const artists = await Artists.list();

    expect(artists).toHaveLength(2);
    expect(artists[0]?.id).toBe('90071992547409931234');
    expect(typeof artists[0]?.id).toBe('string');
    expect(artists[1]?.id).toBe(44);
    expect(artists[1]?.partyId).toBe(44);
  });

  it('Artists.list replaces blank timestamp fields with ISO defaults', async () => {
    get.mockResolvedValueOnce([
      {
        artistId: 11,
        artistPartyId: 11,
        artistName: 'Timestamp Artist',
        artistCreatedAt: '  ',
        artistUpdatedAt: '',
      },
    ]);

    const artists = await Artists.list();

    expect(artists).toHaveLength(1);
    expect(artists[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(artists[0]?.updatedAt).toMatch(ISO_TIMESTAMP_PREFIX);
  });

  it('Venues.list trims contact metadata and ignores blank derived state', async () => {
    get.mockResolvedValueOnce([
      {
        venueId: ' 7 ',
        venueName: 'Sala Centro',
        venueAddress: '  Av. 123 ',
        venueCity: 'Quito,   ',
        venueState: '',
        venueCountry: ' EC ',
        venueLat: -0.18,
        venueLng: -78.47,
        venueContact: {
          phone: '   ',
          website: ' https://venue.example ',
        },
        venuePhone: null,
        venueWebsite: null,
      },
    ]);

    const venues = await Venues.list();

    expect(venues).toHaveLength(1);
    expect(venues[0]?.id).toBe(7);
    expect(venues[0]?.address).toBe('Av. 123');
    expect(venues[0]?.country).toBe('EC');
    expect(venues[0]?.state).toBeNull();
    expect(venues[0]?.phoneNumber).toBeNull();
    expect(venues[0]?.website).toBe('https://venue.example');
  });

  it('Venues.list preserves oversized digit ids without unsafe numeric coercion', async () => {
    get.mockResolvedValueOnce([
      {
        venueId: '90071992547409931234',
        venueName: 'Large Id Venue',
        venueAddress: 'Av. 99',
        venueCity: 'Quito',
        venueCountry: 'EC',
        venueLat: -0.18,
        venueLng: -78.47,
      },
    ]);

    const venues = await Venues.list();

    expect(venues).toHaveLength(1);
    expect(venues[0]?.id).toBe('90071992547409931234');
    expect(typeof venues[0]?.id).toBe('string');
  });

  it('Venues.list sanitizes invalid numeric coordinate/capacity values', async () => {
    get.mockResolvedValueOnce([
      {
        venueId: 8,
        venueName: 'Broken Venue',
        venueAddress: 'Av. 404',
        venueCity: 'Quito',
        venueLat: Number.NaN,
        venueLng: Number.POSITIVE_INFINITY,
        venueCapacity: Number.NEGATIVE_INFINITY,
      },
    ]);

    const venues = await Venues.list();

    expect(venues).toHaveLength(1);
    expect(venues[0]?.latitude).toBe(0);
    expect(venues[0]?.longitude).toBe(0);
    expect(venues[0]?.capacity).toBeNull();
  });

  it('Venues.list replaces blank timestamp fields with ISO defaults', async () => {
    get.mockResolvedValueOnce([
      {
        venueId: 12,
        venueName: 'Timestamp Venue',
        venueAddress: 'Av. 123',
        venueCity: 'Quito',
        venueCreatedAt: ' ',
        venueUpdatedAt: '   ',
      },
    ]);

    const venues = await Venues.list();

    expect(venues).toHaveLength(1);
    expect(venues[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(venues[0]?.updatedAt).toMatch(ISO_TIMESTAMP_PREFIX);
  });

  it('Events.list sanitizes invalid ticket price values from backend payloads', async () => {
    get.mockResolvedValueOnce([
      {
        eventId: 101,
        eventTitle: 'Broken Price Event',
        eventStart: '2026-01-01T00:00:00.000Z',
        eventEnd: '2026-01-01T01:00:00.000Z',
        eventVenueId: null,
        eventPriceCents: Number.NaN,
        eventIsPublic: true,
      },
      {
        eventId: 102,
        eventTitle: 'Negative Price Event',
        eventStart: '2026-01-01T00:00:00.000Z',
        eventEnd: '2026-01-01T01:00:00.000Z',
        eventVenueId: null,
        eventPriceCents: -500,
        eventIsPublic: true,
      },
      {
        eventId: 103,
        eventTitle: 'Free Event',
        eventStart: '2026-01-01T00:00:00.000Z',
        eventEnd: '2026-01-01T01:00:00.000Z',
        eventVenueId: null,
        eventPriceCents: 0,
        eventIsPublic: true,
      },
    ]);

    const events = await Events.list();

    expect(events).toHaveLength(3);
    expect(events[0]?.ticketPrice).toBeNull();
    expect(events[1]?.ticketPrice).toBeNull();
    expect(events[2]?.ticketPrice).toBe(0);
  });

  it('Events mappers sanitize blank timestamp fields across events, RSVPs, and invitations', async () => {
    get
      .mockResolvedValueOnce([
        {
          eventId: 201,
          eventTitle: 'Timestamp Event',
          eventStart: '2026-01-01T00:00:00.000Z',
          eventEnd: '2026-01-01T01:00:00.000Z',
          eventVenueId: null,
          eventCreatedAt: '   ',
          eventUpdatedAt: ' ',
        },
      ])
      .mockResolvedValueOnce([
        {
          rsvpId: 1,
          rsvpEventId: 201,
          rsvpPartyId: 300,
          rsvpStatus: 'accepted',
          rsvpCreatedAt: ' ',
          rsvpUpdatedAt: '   ',
        },
      ])
      .mockResolvedValueOnce([
        {
          invitationId: 1,
          invitationEventId: 201,
          invitationToPartyId: 300,
          invitationCreatedAt: '   ',
          invitationUpdatedAt: ' ',
        },
      ]);

    const events = await Events.list();
    const rsvps = await Events.getRSVPs(201);
    const invitations = await Events.getInvitations(201);

    expect(events).toHaveLength(1);
    expect(events[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(events[0]?.updatedAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(rsvps).toHaveLength(1);
    expect(rsvps[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(rsvps[0]?.updatedAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(invitations).toHaveLength(1);
    expect(invitations[0]?.createdAt).toMatch(ISO_TIMESTAMP_PREFIX);
    expect(invitations[0]?.updatedAt).toBeNull();
  });
});
