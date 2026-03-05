jest.mock('../src/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  del: jest.fn(),
}));

import { Artists } from '../src/api/artists';
import { Venues } from '../src/api/venues';

const { get, post } = jest.requireMock('../src/api/client') as {
  get: jest.Mock;
  post: jest.Mock;
};

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
});
