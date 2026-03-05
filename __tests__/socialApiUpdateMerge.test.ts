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
