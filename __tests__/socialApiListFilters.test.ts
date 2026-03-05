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

const { get } = jest.requireMock('../src/api/client') as {
  get: jest.Mock;
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

  it('ignores invalid numeric filters', async () => {
    get.mockResolvedValueOnce([]);

    await Artists.list({ limit: 0, offset: -3 });

    expect(get).toHaveBeenCalledWith('/social-events/artists');
  });

  it('Artists.list trims text filters and skips blank values', async () => {
    get.mockResolvedValueOnce([]);

    await Artists.list({ name: '  Ana  ', genre: '   ' });

    expect(get).toHaveBeenCalledWith('/social-events/artists?name=Ana');
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
});
