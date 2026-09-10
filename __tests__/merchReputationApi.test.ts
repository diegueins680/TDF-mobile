const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();

jest.mock('../src/api/client', () => ({
  get: (...args: unknown[]) => mockGet(...args),
  post: (...args: unknown[]) => mockPost(...args),
  put: (...args: unknown[]) => mockPut(...args),
}));

import { MerchReputation } from '../src/api/merchReputation';

describe('mobile merch reputation API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('claims a guest order using only the protected capability header', async () => {
    mockPut.mockResolvedValueOnce({ orderId: 'order/id', buyerLinked: true });

    await MerchReputation.claimBuyer('order/id', 'private-order-capability');

    expect(mockPut).toHaveBeenCalledWith(
      '/merch/orders/order%2Fid/review-buyer-claim',
      undefined,
      { headers: { 'X-Order-Lookup-Token': 'private-order-capability' } },
    );
  });
});
