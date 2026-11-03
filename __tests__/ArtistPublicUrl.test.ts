import { artistPublicUrl, isArtistWebNavigation, isVideoProviderNavigation } from '../src/lib/artistPublicUrl';
import { mobileDeepLinkTarget, safeInternalRoute } from '../src/navigation/deepLinks';

describe('canonical public artist identity and playback route', () => {
  it('uses the fan artist Party identity, without confusing social-event artist IDs', () => {
    expect(artistPublicUrl('rojo')).toBe('https://www.tdfrecords.net/a/rojo');
    expect(artistPublicUrl('520')).toBe('https://www.tdfrecords.net/a/520');
    expect(safeInternalRoute('/artistPublic?slugOrId=520')).toBe('/artistPublic?slugOrId=520');
    expect(mobileDeepLinkTarget('https://www.tdfrecords.net/a/rojo?utm_source=instagram', '/')).toBe('/artistPublic?slugOrId=rojo&utm_source=instagram');
    expect(mobileDeepLinkTarget('tdf://artista/rojo?slugOrId=other', '/')).toBe('/artistPublic?slugOrId=rojo');
    expect(artistPublicUrl('rojo', { video: 'youtube:uRNyIMLiqU8', utm_source: 'instagram', token: 'private-value', slugOrId: 'other' })).toBe('https://www.tdfrecords.net/a/rojo?video=youtube%3AuRNyIMLiqU8&utm_source=instagram');
    expect(artistPublicUrl('rojo', { video: 'a'.repeat(201) })).toBeNull();
  });
  it.each(['../private', 'https://evil.test', '//evil.test', 'rojo?other=1', ''])('rejects a substituted profile %s', value => expect(artistPublicUrl(value)).toBeNull());
  it('keeps native top-level navigation on the TDF HTTPS origin', () => {
    expect(isArtistWebNavigation('https://www.tdfrecords.net/login?redirect=%2Fa%2Frojo')).toBe(true);
    expect(isArtistWebNavigation('https://www.tdfrecords.net.evil.test/a/rojo')).toBe(false);
    expect(isArtistWebNavigation('javascript:alert(1)')).toBe(false);
    expect(isVideoProviderNavigation('https://www.youtube-nocookie.com/embed/uRNyIMLiqU8')).toBe(true);
    expect(isVideoProviderNavigation('https://www.youtube-nocookie.com.evil.test/embed/uRNyIMLiqU8')).toBe(false);
  });
});
