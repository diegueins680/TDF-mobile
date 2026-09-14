import {
  buildProviderNeutralTicketCheckoutUrl,
  providerNeutralCheckoutDefaults,
} from '../src/lib/providerNeutralCheckout';

describe('provider-neutral mobile checkout', () => {
  it('opens the canonical web checkout without customer PII', () => {
    const checkout = new URL(buildProviderNeutralTicketCheckoutUrl(
      '42',
      '7',
      2,
      'https://payments.example.test/app/',
    ));
    expect(checkout.origin).toBe('https://payments.example.test');
    expect(checkout.pathname).toBe('/app/eventos/42/entradas');
    expect(checkout.searchParams.get('tierId')).toBe('7');
    expect(checkout.searchParams.get('quantity')).toBe('2');
    expect(checkout.searchParams.get('source')).toBe('mobile');
    expect(checkout.toString()).not.toContain('@');
  });

  it('fails closed for insecure remote or malformed checkout targets', () => {
    expect(() => buildProviderNeutralTicketCheckoutUrl(42, 7, 2, 'http://evil.test'))
      .toThrow('Secure web checkout URL is invalid.');
    expect(() => buildProviderNeutralTicketCheckoutUrl('not-an-id', 7, 2))
      .toThrow('eventId must be a positive integer.');
  });

  it('defaults to the published TDF web application', () => {
    expect(providerNeutralCheckoutDefaults.webBase).toBe('https://tdf-app.pages.dev');
  });
});
