jest.mock('../src/api/client', () => ({
  http: {
    post: jest.fn(),
  },
}));

import { buildVCardSharePayload, exchangeVCard, parseVCardPayload } from '../src/api/social';

const { http } = jest.requireMock('../src/api/client') as {
  http: {
    post: jest.Mock;
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
    expect(http.post).not.toHaveBeenCalled();
  });

  it('exchangeVCard sends validated payload to the API', async () => {
    http.post.mockResolvedValueOnce({});

    await exchangeVCard(17);

    expect(http.post).toHaveBeenCalledWith('/social/vcard-exchange', { vcerPartyId: 17 });
  });
});
