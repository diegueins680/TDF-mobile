jest.mock('../src/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

import { getParty } from '../src/api/parties';

const { get } = jest.requireMock('../src/api/client') as {
  get: jest.Mock;
};

describe('parties API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves a digit party ID as a string when building the lookup path', async () => {
    get.mockResolvedValue({ partyId: 7, displayName: 'Ana' });

    await getParty('90071992547409931234');

    expect(get).toHaveBeenCalledWith('/parties/90071992547409931234');
  });

  it('rejects invalid party lookup IDs before sending a request', async () => {
    await expect(getParty('7/roles')).rejects.toThrow('Party ID inválido.');
    expect(get).not.toHaveBeenCalled();
  });
});
