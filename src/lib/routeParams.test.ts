import { normalizeRouteParam } from './routeParams';

describe('normalizeRouteParam', () => {
  it('trims plain string params', () => {
    expect(normalizeRouteParam('  42  ')).toBe('42');
  });

  it('returns the first non-empty value from param arrays', () => {
    expect(normalizeRouteParam(['  ', 'artist-9', 'artist-10'])).toBe('artist-9');
  });

  it('returns null for missing or blank params', () => {
    expect(normalizeRouteParam(undefined)).toBeNull();
    expect(normalizeRouteParam(null)).toBeNull();
    expect(normalizeRouteParam('   ')).toBeNull();
    expect(normalizeRouteParam(['', '   '])).toBeNull();
  });
});
