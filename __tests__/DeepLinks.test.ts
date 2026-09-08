import {
  currentRouteReturnTo,
  directoryDeepLinkTarget,
  mobileDeepLinkTarget,
  safeInternalRoute,
} from '../src/navigation/deepLinks';

describe('directory deep links', () => {
  it('does not navigate again when the browser already opened the destination', () => {
    expect(directoryDeepLinkTarget('directory/manage', '/directory/manage')).toBeNull();
  });

  it('normalizes slashes and preserves navigation to a different directory destination', () => {
    expect(directoryDeepLinkTarget('/directory/profile/perfil-demo/', '/directory')).toBe(
      '/directory/profile/perfil-demo',
    );
  });
});

describe('mobile deep-link routing', () => {
  it('resolves double- and triple-slash event links to the same exact context', () => {
    const target = '/eventDetail?eventId=42&tab=moments';
    expect(mobileDeepLinkTarget('tdf://event/42?tab=moments', '/')).toBe(target);
    expect(mobileDeepLinkTarget('tdf:///event/42?tab=moments', '/')).toBe(target);
  });

  it('normalizes repeated separators and keeps the path id authoritative', () => {
    expect(mobileDeepLinkTarget('tdf:////event//event%2042?eventId=wrong', '/')).toBe(
      '/eventDetail?eventId=event+42',
    );
  });

  it('preserves encoded directory service filters for the native search route', () => {
    expect(mobileDeepLinkTarget('tdf://directory?serviceId=7&q=mezcla%20en%20vivo', '/')).toBe(
      '/(tabs)/directory?serviceId=7&q=mezcla+en+vivo',
    );
  });

  it('supports Expo development links only after their explicit route marker', () => {
    expect(mobileDeepLinkTarget('exp://127.0.0.1:8081/--/artist/9', '/')).toBe(
      '/artistDetail?artistId=9',
    );
    expect(mobileDeepLinkTarget('exp://127.0.0.1:8081/artist/9', '/')).toBeNull();
  });

  it('rejects external schemes, credentials, fragments, and unknown routes', () => {
    expect(mobileDeepLinkTarget('https://evil.example/event/42', '/')).toBeNull();
    expect(mobileDeepLinkTarget('tdf://user@event/42', '/')).toBeNull();
    expect(mobileDeepLinkTarget('tdf:///event/42#https://evil.example', '/')).toBeNull();
    expect(mobileDeepLinkTarget('tdf:///unknown/42', '/')).toBeNull();
  });
});

describe('post-auth internal routes', () => {
  it('keeps a registered route query exactly through the auth boundary', () => {
    expect(safeInternalRoute('/ticketCheckout?eventId=42')).toBe('/ticketCheckout?eventId=42');
    expect(currentRouteReturnTo('/eventDetail', '/eventDetail?eventId=42')).toBe(
      '/eventDetail?eventId=42',
    );
  });

  it('reapplies the exact query to a registered grouped route', () => {
    expect(currentRouteReturnTo('/(tabs)/bookings', '/bookings?status=upcoming')).toBe(
      '/(tabs)/bookings?status=upcoming',
    );
  });

  it('rejects scheme-relative, backslash, encoded separator, and unknown targets', () => {
    expect(safeInternalRoute('//evil.example/tickets')).toBeNull();
    expect(safeInternalRoute('/\\evil.example/tickets')).toBeNull();
    expect(safeInternalRoute('/%2F%2Fevil.example/tickets')).toBeNull();
    expect(safeInternalRoute('/not-a-real-route?eventId=42')).toBeNull();
  });
});
