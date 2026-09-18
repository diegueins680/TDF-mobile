jest.mock('../src/api/client', () => ({ get: jest.fn(), post: jest.fn() }));
import { FanArtists } from '../src/api/fanArtists';
const { get, post } = jest.requireMock('../src/api/client') as { get: jest.Mock; post: jest.Mock };

describe('canonical FanHub contract', () => {
  beforeEach(() => jest.clearAllMocks());
  it('uses the web catalog and persisted follow contract, never social-event artist IDs', async () => {
    await FanArtists.list();
    await FanArtists.listFollows();
    post.mockResolvedValueOnce({ ffArtistId: 71, ffArtistName: 'Artista Uno' });
    expect(await FanArtists.follow(71)).toEqual({ ffArtistId: 71, ffArtistName: 'Artista Uno' });
    expect(get.mock.calls).toEqual([['/fans/artists'], ['/fans/me/follows']]);
    expect(post).toHaveBeenCalledWith('/fans/me/follows/71', {});
  });
  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid Party ID %s before sending', async value => {
    await expect(FanArtists.follow(value)).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });
});
