jest.mock('../src/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  del: jest.fn(),
}));

import { Artists } from '../src/api/artists';

const { get } = jest.requireMock('../src/api/client') as {
  get: jest.Mock;
};

describe('Artists.getByParty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('finds an artist by party id across paginated results', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      artistId: String(index + 1001),
      artistPartyId: String(index + 1001),
      artistName: `Artist ${index + 1001}`,
    }));

    get
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([
        {
          artistId: '99',
          artistPartyId: ' 42 ',
          artistName: 'Matched Artist',
          artistGenres: ['Rock'],
        },
      ]);

    const artist = await Artists.getByParty('42');

    expect(artist.partyId).toBe(42);
    expect(artist.name).toBe('Matched Artist');
    expect(get).toHaveBeenNthCalledWith(1, '/social-events/artists?limit=100&offset=0');
    expect(get).toHaveBeenNthCalledWith(2, '/social-events/artists?limit=100&offset=100');
  });

  it('rejects invalid party ids before making API calls', async () => {
    await expect(Artists.getByParty('   ')).rejects.toThrow('Party ID inválido');
    expect(get).not.toHaveBeenCalled();
  });

  it('throws a clear error when no artist profile exists for the party id', async () => {
    get.mockResolvedValueOnce([]);

    await expect(Artists.getByParty('3001')).rejects.toThrow('No existe perfil de artista para partyId 3001.');
    expect(get).toHaveBeenCalledWith('/social-events/artists?limit=100&offset=0');
  });
});
