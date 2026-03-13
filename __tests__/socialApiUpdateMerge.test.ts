jest.mock('../src/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  del: jest.fn(),
}));

jest.mock('../src/api/venues', () => {
  const actual = jest.requireActual('../src/api/venues');
  return {
    ...actual,
    Venues: {
      ...actual.Venues,
      getById: jest.fn(),
    },
  };
});

import { Events } from '../src/api/events';
import { Artists } from '../src/api/artists';
import { Venues } from '../src/api/venues';

const { get, post, put } = jest.requireMock('../src/api/client') as {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
};

const mockedVenuesModule = jest.requireMock('../src/api/venues') as {
  Venues: {
    getById: jest.Mock;
  };
};

describe('Social API update merge behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Events.update keeps required fields and artists when patch omits them', async () => {
    mockedVenuesModule.Venues.getById.mockResolvedValue({
      id: 12,
      name: 'Main Room',
      address: 'Av. Demo',
      city: 'Quito',
      country: 'EC',
      latitude: 0,
      longitude: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    get.mockResolvedValueOnce({
      eventId: 9,
      eventTitle: 'Original title',
      eventDescription: 'Original desc',
      eventStart: '2026-04-01T10:00:00.000Z',
      eventEnd: '2026-04-01T12:00:00.000Z',
      eventVenueId: '12',
      eventPriceCents: 3500,
      eventIsPublic: true,
      eventArtists: [{ artistId: 7, artistName: 'DJ Uno' }],
    });

    put.mockResolvedValueOnce({
      eventId: 9,
      eventTitle: 'Updated title',
      eventDescription: 'Original desc',
      eventStart: '2026-04-01T10:00:00.000Z',
      eventEnd: '2026-04-01T12:00:00.000Z',
      eventVenueId: '12',
      eventPriceCents: 3500,
      eventIsPublic: true,
      eventArtists: [{ artistId: 7, artistName: 'DJ Uno' }],
    });

    await Events.update(9, { title: 'Updated title' });

    expect(put).toHaveBeenCalledWith('/social-events/events/9', expect.objectContaining({
      eventTitle: 'Updated title',
      eventStart: '2026-04-01T10:00:00.000Z',
      eventEnd: '2026-04-01T12:00:00.000Z',
      eventVenueId: '12',
      eventArtists: [{ artistId: 7 }],
    }));
  });

  it('Events.update keeps existing ticket price when patch ticket price is invalid', async () => {
    get.mockResolvedValueOnce({
      eventId: 9,
      eventTitle: 'Original title',
      eventDescription: 'Original desc',
      eventStart: '2026-04-01T10:00:00.000Z',
      eventEnd: '2026-04-01T12:00:00.000Z',
      eventVenueId: null,
      eventPriceCents: 3500,
      eventIsPublic: true,
      eventArtists: [],
    });

    put.mockResolvedValueOnce({
      eventId: 9,
      eventTitle: 'Original title',
      eventDescription: 'Original desc',
      eventStart: '2026-04-01T10:00:00.000Z',
      eventEnd: '2026-04-01T12:00:00.000Z',
      eventVenueId: null,
      eventPriceCents: 3500,
      eventIsPublic: true,
      eventArtists: [],
    });

    await Events.update(9, { ticketPrice: Number.NaN });

    expect(put).toHaveBeenCalledWith(
      '/social-events/events/9',
      expect.objectContaining({
        eventPriceCents: 3500,
      }),
    );
  });

  it('Events.update clears nullable fields when patch uses null', async () => {
    get.mockResolvedValueOnce({
      eventId: 9,
      eventTitle: 'Original title',
      eventDescription: 'Original desc',
      eventStart: '2026-04-01T10:00:00.000Z',
      eventEnd: '2026-04-01T12:00:00.000Z',
      eventVenueId: '12',
      eventPriceCents: 3500,
      eventTicketUrl: 'https://tickets.example.com/original',
      eventImageUrl: 'https://images.example.com/original.jpg',
      eventIsPublic: true,
      eventArtists: [],
    });

    put.mockResolvedValueOnce({
      eventId: 9,
      eventTitle: 'Original title',
      eventDescription: null,
      eventStart: '2026-04-01T10:00:00.000Z',
      eventEnd: '2026-04-01T12:00:00.000Z',
      eventVenueId: null,
      eventPriceCents: null,
      eventTicketUrl: null,
      eventImageUrl: null,
      eventIsPublic: true,
      eventArtists: [],
    });

    await Events.update(9, {
      description: null,
      venueId: null,
      ticketPrice: null,
      ticketUrl: null,
      imageUrl: null,
    });

    const payload = put.mock.calls[0]?.[1];
    expect(payload.eventDescription).toBeUndefined();
    expect(payload.eventVenueId).toBeNull();
    expect(payload.eventPriceCents).toBeNull();
    expect(payload.eventTicketUrl).toBeNull();
    expect(payload.eventImageUrl).toBeNull();
  });

  it('Events.create serializes missing venue sentinels as null', async () => {
    post.mockResolvedValueOnce({
      eventId: 21,
      eventTitle: 'No Venue Event',
      eventStart: '2026-05-01T18:00:00.000Z',
      eventEnd: '2026-05-01T20:00:00.000Z',
      eventVenueId: null,
      eventArtists: [],
      eventIsPublic: true,
    });

    await Events.create({
      title: 'No Venue Event',
      startTime: '2026-05-01T18:00:00.000Z',
      endTime: '2026-05-01T20:00:00.000Z',
      venueId: 0,
      artistIds: [],
      isPublic: true,
    });

    expect(post).toHaveBeenCalledWith(
      '/social-events/events',
      expect.objectContaining({
        eventVenueId: null,
      }),
    );
  });

  it('Events.create rejects invalid ticket prices before sending payload', async () => {
    await expect(
      Events.create({
        title: 'Broken Price Event',
        startTime: '2026-05-01T18:00:00.000Z',
        endTime: '2026-05-01T20:00:00.000Z',
        venueId: 0,
        artistIds: [],
        ticketPrice: Number.NaN,
        isPublic: true,
      }),
    ).rejects.toThrow('Ticket price must be a valid number greater than or equal to zero.');

    await expect(
      Events.create({
        title: 'Negative Price Event',
        startTime: '2026-05-01T18:00:00.000Z',
        endTime: '2026-05-01T20:00:00.000Z',
        venueId: 0,
        artistIds: [],
        ticketPrice: -5,
        isPublic: true,
      }),
    ).rejects.toThrow('Ticket price must be a valid number greater than or equal to zero.');

    expect(post).not.toHaveBeenCalled();
  });

  it('Events.create preserves oversized venue id strings without precision loss', async () => {
    const largeVenueId = '90071992547409931234';
    post.mockResolvedValueOnce({
      eventId: 22,
      eventTitle: 'Large Venue Event',
      eventStart: '2026-05-10T18:00:00.000Z',
      eventEnd: '2026-05-10T20:00:00.000Z',
      eventVenueId: largeVenueId,
      eventArtists: [],
      eventIsPublic: true,
    });

    await Events.create({
      title: 'Large Venue Event',
      startTime: '2026-05-10T18:00:00.000Z',
      endTime: '2026-05-10T20:00:00.000Z',
      venueId: largeVenueId,
      artistIds: [],
      isPublic: true,
    });

    expect(post).toHaveBeenCalledWith(
      '/social-events/events',
      expect.objectContaining({
        eventVenueId: largeVenueId,
      }),
    );
  });

  it('Events.list trims string filters and still applies upcoming fallback', async () => {
    get.mockResolvedValueOnce([]);

    await Events.list({
      city: '  Quito  ',
      startAfter: '   ',
      upcomingOnly: true,
    });

    const calledPath = get.mock.calls[0]?.[0] as string;
    expect(calledPath).toMatch(/^\/social-events\/events\?city=Quito&start_after=/);
    expect(calledPath).not.toContain('%20%20Quito');
  });

  it('Events.list keeps venue details when venue lookup id is canonicalized by backend', async () => {
    mockedVenuesModule.Venues.getById.mockResolvedValueOnce({
      id: 12,
      name: 'Main Hall',
      address: 'Av. Venue',
      city: 'Quito',
      country: 'EC',
      latitude: -0.2,
      longitude: -78.5,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    get.mockResolvedValueOnce([
      {
        eventId: 31,
        eventTitle: 'Canonical Venue Event',
        eventStart: '2026-05-10T18:00:00.000Z',
        eventEnd: '2026-05-10T20:00:00.000Z',
        eventVenueId: 'north-stage',
        eventIsPublic: true,
      },
    ]);

    const events = await Events.list();

    expect(mockedVenuesModule.Venues.getById).toHaveBeenCalledWith('north-stage');
    expect(events[0]?.venueId).toBe('north-stage');
    expect(events[0]?.venue?.id).toBe(12);
    expect(events[0]?.venue?.name).toBe('Main Hall');
  });

  it('Events.list counts only GOING RSVPs in attendee totals', async () => {
    get.mockResolvedValueOnce([
      {
        eventId: 32,
        eventTitle: 'Attendance Event',
        eventStart: '2026-05-10T18:00:00.000Z',
        eventEnd: '2026-05-10T20:00:00.000Z',
        eventVenueId: null,
        eventIsPublic: true,
        eventArtists: [],
        eventRsvps: [
          { rsvpPartyId: '1', rsvpStatus: 'Accepted' },
          { rsvpPartyId: '2', rsvpStatus: 'Going' },
          { rsvpPartyId: '3', rsvpStatus: 'Maybe' },
          { rsvpPartyId: '4', rsvpStatus: 'Declined' },
        ],
      },
    ]);

    const events = await Events.list();

    expect(events[0]?.rsvpCount).toBe(2);
  });

  it('Events.sendInvitation preserves explicit fromUserId values like 0', async () => {
    post.mockResolvedValueOnce({
      invitationId: 88,
      invitationEventId: 9,
      invitationFromPartyId: '0',
      invitationToPartyId: '12',
      invitationStatus: 'Pending',
      invitationMessage: null,
    });

    await Events.sendInvitation({
      eventId: 9,
      fromUserId: 0,
      toUserId: 12,
      status: 'PENDING',
    });

    expect(post).toHaveBeenCalledWith(
      '/social-events/events/9/invitations',
      expect.objectContaining({
        invitationFromPartyId: '0',
        invitationToPartyId: '12',
      }),
    );
  });

  it('Events.sendInvitation drops malformed numeric fromUserId values', async () => {
    post.mockResolvedValueOnce({
      invitationId: 89,
      invitationEventId: 9,
      invitationFromPartyId: null,
      invitationToPartyId: '12',
      invitationStatus: 'Pending',
      invitationMessage: null,
    });

    await Events.sendInvitation({
      eventId: 9,
      fromUserId: Number.NaN,
      toUserId: 12,
      status: 'PENDING',
    });

    expect(post).toHaveBeenCalledWith(
      '/social-events/events/9/invitations',
      expect.objectContaining({
        invitationFromPartyId: undefined,
        invitationToPartyId: '12',
      }),
    );
  });

  it('Events.respondToInvitation includes invitationToPartyId for backend update schema', async () => {
    get.mockResolvedValueOnce([
      {
        invitationId: '88',
        invitationEventId: 9,
        invitationFromPartyId: '2',
        invitationToPartyId: '12',
        invitationStatus: 'Pending',
        invitationMessage: null,
      },
    ]);

    put.mockResolvedValueOnce({
      invitationId: 88,
      invitationEventId: 9,
      invitationFromPartyId: '2',
      invitationToPartyId: '12',
      invitationStatus: 'Accepted',
      invitationMessage: null,
    });

    await Events.respondToInvitation(9, 88, 'ACCEPTED');

    expect(get).toHaveBeenCalledWith('/social-events/events/9/invitations');
    expect(put).toHaveBeenCalledWith(
      '/social-events/events/9/invitations/88',
      expect.objectContaining({
        invitationToPartyId: '12',
        invitationStatus: 'ACCEPTED',
      }),
    );
  });

  it('Events.respondToInvitation trims and encodes string invitation ids in update path', async () => {
    get.mockResolvedValueOnce([
      {
        invitationId: '88',
        invitationEventId: 9,
        invitationFromPartyId: '2',
        invitationToPartyId: '12',
        invitationStatus: 'Pending',
        invitationMessage: null,
      },
    ]);

    put.mockResolvedValueOnce({
      invitationId: 88,
      invitationEventId: 9,
      invitationFromPartyId: '2',
      invitationToPartyId: '12',
      invitationStatus: 'Accepted',
      invitationMessage: null,
    });

    await Events.respondToInvitation(9, ' 88 ', 'ACCEPTED');

    expect(put).toHaveBeenCalledWith(
      '/social-events/events/9/invitations/88',
      expect.objectContaining({
        invitationToPartyId: '12',
        invitationStatus: 'ACCEPTED',
      }),
    );
  });

  it('Events.respondToInvitation throws when invitation does not exist', async () => {
    get.mockResolvedValueOnce([]);

    await expect(Events.respondToInvitation(9, 999, 'DECLINED')).rejects.toThrow(
      'Invitation 999 not found for event 9.',
    );
    expect(put).not.toHaveBeenCalled();
  });

  it('Events.respondToInvitation rejects malformed numeric invitation ids before fetching', async () => {
    await expect(Events.respondToInvitation(9, Number.NaN, 'ACCEPTED')).rejects.toThrow(
      'Invalid invitation id.',
    );
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('Events.rsvp rejects NONE status instead of coercing it to Maybe', async () => {
    await expect(
      Events.rsvp({
        eventId: 9,
        userId: 12,
        status: 'NONE',
      }),
    ).rejects.toThrow('RSVP status NONE cannot be submitted.');
    expect(post).not.toHaveBeenCalled();
  });

  it('Artists.update preserves name and genres when omitted in patch', async () => {
    get.mockResolvedValueOnce({
      artistId: 2,
      artistPartyId: 5,
      artistName: 'Artist Uno',
      artistGenres: ['Rock'],
      artistBio: 'Old bio',
    });

    put.mockResolvedValueOnce({
      artistId: 2,
      artistPartyId: 5,
      artistName: 'Artist Uno',
      artistGenres: ['Rock'],
      artistBio: 'New bio',
    });

    await Artists.update(2, { bio: 'New bio' });

    expect(put).toHaveBeenCalledWith('/social-events/artists/2', expect.objectContaining({
      artistName: 'Artist Uno',
      artistGenres: ['Rock'],
      artistBio: 'New bio',
    }));
  });

  it('Artists.update clears nullable profile fields without dropping untouched links', async () => {
    get.mockResolvedValueOnce({
      artistId: 2,
      artistPartyId: 5,
      artistName: 'Artist Uno',
      artistGenres: ['Rock'],
      artistBio: 'Old bio',
      artistAvatarUrl: 'https://images.example.com/artist.jpg',
      artistSocialLinks: {
        instagram: '@artistuno',
        spotify: 'https://open.spotify.com/artist/uno',
        twitter: 'https://x.com/artistuno',
      },
    });

    put.mockResolvedValueOnce({
      artistId: 2,
      artistPartyId: 5,
      artistName: 'Artist Uno',
      artistGenres: ['Rock'],
      artistBio: null,
      artistAvatarUrl: null,
      artistSocialLinks: {
        spotify: 'https://open.spotify.com/artist/uno',
      },
    });

    await Artists.update(2, {
      bio: null,
      imageUrl: null,
      instagramHandle: null,
      socialLinks: { twitter: null },
    });

    const payload = put.mock.calls[0]?.[1];
    expect(payload.artistBio).toBeUndefined();
    expect(payload.artistAvatarUrl).toBeUndefined();
    expect(payload.artistSocialLinks).toEqual({
      spotify: 'https://open.spotify.com/artist/uno',
    });
  });

  it('Venues.update preserves existing country instead of forcing US', async () => {
    get.mockResolvedValueOnce({
      venueId: 3,
      venueName: 'Sala Uno',
      venueAddress: 'Calle 1',
      venueCity: 'Guayaquil',
      venueCountry: 'EC',
      venueLat: -2.17,
      venueLng: -79.92,
      venueCapacity: 120,
    });

    put.mockResolvedValueOnce({
      venueId: 3,
      venueName: 'Sala Uno Renovada',
      venueAddress: 'Calle 1',
      venueCity: 'Guayaquil',
      venueCountry: 'EC',
      venueLat: -2.17,
      venueLng: -79.92,
      venueCapacity: 120,
    });

    await Venues.update(3, { name: 'Sala Uno Renovada' });

    expect(put).toHaveBeenCalledWith('/social-events/venues/3', expect.objectContaining({
      venueName: 'Sala Uno Renovada',
      venueCountry: 'EC',
    }));
  });

  it('Venues.update clears nullable metadata fields when patch uses null', async () => {
    get.mockResolvedValueOnce({
      venueId: 3,
      venueName: 'Sala Uno',
      venueAddress: 'Calle 1',
      venueCity: 'Guayaquil',
      venueCountry: 'EC',
      venueLat: -2.17,
      venueLng: -79.92,
      venueCapacity: 120,
      venuePhone: '+593999999999',
      venueWebsite: 'https://venue.example.com',
      venueState: 'Guayas',
      venueZipCode: '090101',
      venueImageUrl: 'https://images.example.com/venue.jpg',
    });

    put.mockResolvedValueOnce({
      venueId: 3,
      venueName: 'Sala Uno',
      venueAddress: 'Calle 1',
      venueCity: 'Guayaquil',
      venueCountry: null,
      venueLat: -2.17,
      venueLng: -79.92,
      venueCapacity: null,
      venuePhone: null,
      venueWebsite: null,
      venueState: null,
      venueZipCode: null,
      venueImageUrl: null,
    });

    await Venues.update(3, {
      country: null,
      capacity: null,
      phoneNumber: null,
      website: null,
      state: null,
      zipCode: null,
      imageUrl: null,
    });

    const payload = put.mock.calls[0]?.[1];
    expect(payload.venueCountry).toBeNull();
    expect(payload.venueCapacity).toBeUndefined();
    expect(payload.venuePhone).toBeNull();
    expect(payload.venueWebsite).toBeNull();
    expect(payload.venueState).toBeNull();
    expect(payload.venueZipCode).toBeNull();
    expect(payload.venueImageUrl).toBeNull();
  });

  it('Venues.create defaults country to US when not provided', async () => {
    post.mockResolvedValueOnce({
      venueId: 4,
      venueName: 'Venue New',
      venueAddress: 'Addr',
      venueCity: 'Miami',
      venueCountry: 'US',
      venueLat: 25.76,
      venueLng: -80.19,
    });

    await Venues.create({
      name: 'Venue New',
      address: 'Addr',
      city: 'Miami',
      latitude: 25.76,
      longitude: -80.19,
    });

    expect(post).toHaveBeenCalledWith('/social-events/venues', expect.objectContaining({
      venueCountry: 'US',
    }));
  });
});
