jest.mock('../src/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

import { createParty, getParty } from '../src/api/parties';

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

it('carries the same request identity on contact retries including field edits', async () => {
  const { post } = jest.requireMock('../src/api/client') as { post: jest.Mock };
  post.mockRejectedValueOnce(new Error('response lost')).mockResolvedValue({ partyId: 7, displayName: 'Corrected' });
  await expect(createParty({ name: 'New' }, 'synthetic-contact-request')).rejects.toThrow('response lost');
  await createParty({ name: 'Corrected' }, 'synthetic-contact-request');
  expect(post.mock.calls[0][2]).toEqual({ headers: { 'Idempotency-Key': 'synthetic-contact-request' } });
  expect(post.mock.calls[1][2]).toEqual(post.mock.calls[0][2]);
});
