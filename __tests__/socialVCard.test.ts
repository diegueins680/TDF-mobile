jest.mock('../src/api/client', () => ({
  http: {
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

import { Social, buildVCardSharePayload, exchangeVCard, parseVCardPayload } from '../src/api/social';

const { http } = jest.requireMock('../src/api/client') as {
  http: {
    post: jest.Mock;
    delete: jest.Mock;
  };
};

describe('Social vCard payload helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('buildVCardSharePayload trims text fields and keeps only positive integer party ids', () => {
    const payload = buildVCardSharePayload({
      name: '  Ana  ',
      email: ' ana@example.com ',
      phone: '   ',
      partyId: -5,
    });

    const parsed = JSON.parse(payload) as Record<string, unknown>;
    expect(parsed['kind']).toBe('vcard-exchange');
    expect(parsed['name']).toBe('Ana');
    expect(parsed['email']).toBe('ana@example.com');
    expect(parsed['phone']).toBeUndefined();
    expect(parsed['partyId']).toBeNull();
    expect(typeof parsed['ts']).toBe('number');
  });

  it('parseVCardPayload sanitizes fields and accepts numeric string party ids', () => {
    const result = parseVCardPayload(
      JSON.stringify({
        kind: 'vcard-exchange',
        name: '  Carla  ',
        email: 'carla@example.com',
        phone: 12345,
        partyId: '0042',
        ts: 1_700_000_000_000,
      }),
    );

    expect(result).toEqual({
      kind: 'vcard-exchange',
      name: 'Carla',
      email: 'carla@example.com',
      phone: null,
      partyId: 42,
      ts: 1_700_000_000_000,
    });
  });

  it('parseVCardPayload rejects malformed payloads and invalid party ids', () => {
    expect(parseVCardPayload('')).toBeNull();
    expect(parseVCardPayload(JSON.stringify({ kind: 'other' }))).toBeNull();

    const result = parseVCardPayload(
      JSON.stringify({
        kind: 'vcard-exchange',
        name: 'Nombre',
        partyId: 'not-a-number',
        ts: 'yesterday',
      }),
    );

    expect(result).toEqual({
      kind: 'vcard-exchange',
      name: 'Nombre',
      email: null,
      phone: null,
      partyId: null,
      ts: undefined,
    });
  });

  it('exchangeVCard rejects invalid party ids without calling the API', async () => {
    await expect(exchangeVCard(0)).rejects.toThrow('Party ID inválido para intercambio de vCard.');
    await expect(exchangeVCard(-1)).rejects.toThrow('Party ID inválido para intercambio de vCard.');
    await expect(exchangeVCard(1.5)).rejects.toThrow('Party ID inválido para intercambio de vCard.');
    await expect(exchangeVCard(Number.MAX_SAFE_INTEGER + 1)).rejects.toThrow('Party ID inválido para intercambio de vCard.');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('exchangeVCard sends validated payload to the API', async () => {
    http.post.mockResolvedValueOnce({});

    await exchangeVCard(17);

    expect(http.post).toHaveBeenCalledWith('/social/vcard-exchange', { vcerPartyId: 17 });
  });

  it('Social.addFriend validates party ids before calling the API', async () => {
    await expect(Social.addFriend(0)).rejects.toThrow('Party ID inválido para agregar amistad.');
    await expect(Social.addFriend(-3)).rejects.toThrow('Party ID inválido para agregar amistad.');
    await expect(Social.addFriend(2.5)).rejects.toThrow('Party ID inválido para agregar amistad.');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('Social.addFriend calls the expected endpoint for valid ids', async () => {
    http.post.mockResolvedValueOnce({ data: [] });

    await Social.addFriend(23);

    expect(http.post).toHaveBeenCalledWith('/social/friends/23', {});
  });

  it('Social.removeFriend validates party ids before calling the API', async () => {
    await expect(Social.removeFriend(0)).rejects.toThrow('Party ID inválido para eliminar amistad.');
    await expect(Social.removeFriend(4.2)).rejects.toThrow('Party ID inválido para eliminar amistad.');
    expect(http.delete).not.toHaveBeenCalled();
  });

  it('Social.removeFriend calls the expected endpoint for valid ids', async () => {
    http.delete.mockResolvedValueOnce({});

    await Social.removeFriend(11);

    expect(http.delete).toHaveBeenCalledWith('/social/friends/11');
  });
});
