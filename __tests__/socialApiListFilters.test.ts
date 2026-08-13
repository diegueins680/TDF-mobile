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

import { Artists } from '../src/api/artists';
import { Events } from '../src/api/events';
import { Venues } from '../src/api/venues';

const { get, put } = jest.requireMock('../src/api/client') as {
  get: jest.Mock;
  put: jest.Mock;
};

describe('Social list filter serialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Artists.list keeps offset=0', async () => {
    get.mockResolvedValueOnce([]);

    await Artists.list({ offset: 0 });

    expect(get).toHaveBeenCalledWith('/social-events/artists?offset=0');
  });

  it('Venues.list keeps offset=0 and truncates limit', async () => {
    get.mockResolvedValueOnce([]);

    await Venues.list({ limit: 10.8, offset: 0 });

    expect(get).toHaveBeenCalledWith('/social-events/venues?limit=10&offset=0');
  });

  it('Events.list keeps offset=0', async () => {
    get.mockResolvedValueOnce([]);

    await Events.list({ limit: 5, offset: 0, upcomingOnly: false });

    expect(get).toHaveBeenCalledWith('/social-events/events?limit=5&offset=0');
  });

  it('Events.list serializes the subscribed discovery scope', async () => {
    get.mockResolvedValueOnce([]);

    await Events.list({ scope: 'subscribed', upcomingOnly: false });

    expect(get).toHaveBeenCalledWith('/social-events/events?scope=subscribed');
  });

  it('replaces country-aware city subscriptions with the backend DTO shape', async () => {
    put.mockResolvedValueOnce([
      {
        eventCityId: '4',
        eventCityName: 'Quito',
        eventCityCountryCode: 'EC',
        eventCityTimeZone: 'America/Guayaquil',
        eventCitySubscribed: true,
      },
    ]);

    const result = await Events.replaceCitySubscriptions([
      { name: ' Quito ', countryCode: 'ec', timeZone: ' America/Guayaquil ' },
    ]);

    expect(put).toHaveBeenCalledWith('/social-events/me/city-subscriptions', {
      eventCities: [
        {
          eventCityInputName: 'Quito',
          eventCityInputCountryCode: 'EC',
          eventCityInputTimeZone: 'America/Guayaquil',
        },
      ],
    });
    expect(result[0]).toEqual({
      id: '4',
      name: 'Quito',
      countryCode: 'EC',
      timeZone: 'America/Guayaquil',
      subscribed: true,
    });
  });

  it('ignores invalid numeric filters', async () => {
    get.mockResolvedValueOnce([]);

    await Artists.list({ limit: 0, offset: -3 });

    expect(get).toHaveBeenCalledWith('/social-events/artists');
  });

  it('drops limits that truncate to zero while preserving valid offsets', async () => {
    get.mockResolvedValueOnce([]);
    get.mockResolvedValueOnce([]);
    get.mockResolvedValueOnce([]);

    await Artists.list({ limit: 0.9, offset: 0.8 });
    await Venues.list({ limit: 0.2, offset: 0 });
    await Events.list({ limit: 0.5, offset: 1.2 });

    expect(get).toHaveBeenNthCalledWith(1, '/social-events/artists?offset=0');
    expect(get).toHaveBeenNthCalledWith(2, '/social-events/venues?offset=0');
    expect(get).toHaveBeenNthCalledWith(3, '/social-events/events?offset=1');
  });

  it('Artists.list trims text filters and skips blank values', async () => {
    get.mockResolvedValueOnce([]);

    await Artists.list({ name: '  Ana  ', genreId: '   ' });

    expect(get).toHaveBeenCalledWith('/social-events/artists?name=Ana');
  });

  it('Artists.list sends canonical genre UUID filters', async () => {
    get.mockResolvedValueOnce([]);
    const genreId = '11111111-1111-4111-8111-111111111111';

    await Artists.list({ genreId });

    expect(get).toHaveBeenCalledWith(`/social-events/artists?genreId=${genreId}`);
  });

  it('Venues.list trims city/query filters and skips blank values', async () => {
    get.mockResolvedValueOnce([]);

    await Venues.list({ city: '  Quito ', query: '   ' });

    expect(get).toHaveBeenCalledWith('/social-events/venues?city=Quito');
  });

  it('Events.list trims string ids and ignores blank ids', async () => {
    get.mockResolvedValueOnce([]);
    get.mockResolvedValueOnce([]);

    await Events.list({ artistId: ' 42 ', venueId: '  7 ' });
    await Events.list({ artistId: '   ', venueId: '' });

    expect(get).toHaveBeenNthCalledWith(1, '/social-events/events?artistId=42&venueId=7');
    expect(get).toHaveBeenNthCalledWith(2, '/social-events/events');
  });

  it('Events.list ignores malformed numeric ids and keeps non-numeric string ids', async () => {
    get.mockResolvedValueOnce([]);
    get.mockResolvedValueOnce([]);

    await Events.list({ artistId: Number.NaN, venueId: Number.POSITIVE_INFINITY });
    await Events.list({ artistId: 'party-a', venueId: 'venue-z' });

    expect(get).toHaveBeenNthCalledWith(1, '/social-events/events');
    expect(get).toHaveBeenNthCalledWith(2, '/social-events/events?artistId=party-a&venueId=venue-z');
  });

  it('Events.list sends only canonical event type UUID filters', async () => {
    get.mockResolvedValueOnce([]);
    get.mockResolvedValueOnce([]);
    const eventTypeId = '41000000-0000-4000-8000-000000000001';

    await Events.list({ eventTypeId });
    await Events.list({ eventTypeId: 'party' });

    expect(get).toHaveBeenNthCalledWith(1, `/social-events/events?event_type_id=${eventTypeId}`);
    expect(get).toHaveBeenNthCalledWith(2, '/social-events/events');
  });
});
