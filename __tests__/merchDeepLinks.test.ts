import { merchDeepLinkTarget } from '../src/navigation/deepLinks';

describe('artist merch deep links', () => {
  it('routes discovery, seller, storefront, product, cart, and private order destinations', () => {
    expect(merchDeepLinkTarget('merch')).toBe('/merch');
    expect(merchDeepLinkTarget('merch/seller')).toBe('/merchSeller');
    expect(merchDeepLinkTarget('merch/store/cementerio-de-elefantes')).toBe('/merch?storeSlug=cementerio-de-elefantes');
    expect(merchDeepLinkTarget('merch/store/cementerio-de-elefantes/product/vinilo')).toBe('/merch?storeSlug=cementerio-de-elefantes&productSlug=vinilo');
    expect(merchDeepLinkTarget('merch/store/cementerio-de-elefantes/cart')).toBe('/merch?storeSlug=cementerio-de-elefantes&view=cart');
    expect(merchDeepLinkTarget('merch/order/order-id')).toBe('/merch?orderId=order-id');
  });

  it('does not claim unrelated paths', () => {
    expect(merchDeepLinkTarget('artist/cementerio-de-elefantes')).toBeNull();
  });
});
