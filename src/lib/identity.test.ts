import { normalizePartyId, resolvePartyId } from './identity';

describe('identity helpers', () => {
  it('normalizes string and numeric party ids', () => {
    expect(normalizePartyId(' 42 ')).toBe('42');
    expect(normalizePartyId('0042')).toBe('42');
    expect(normalizePartyId(17)).toBe('17');
    expect(normalizePartyId('   ')).toBeNull();
    expect(normalizePartyId('abc')).toBeNull();
    expect(normalizePartyId('12x')).toBeNull();
    expect(normalizePartyId(0)).toBeNull();
  });

  it('prefers the first non-empty party id', () => {
    expect(resolvePartyId(' 77 ', '42')).toBe('77');
    expect(resolvePartyId(null, ' 42 ')).toBe('42');
    expect(resolvePartyId(undefined, '', 15)).toBe('15');
    expect(resolvePartyId(null, '   ')).toBeNull();
  });
});
