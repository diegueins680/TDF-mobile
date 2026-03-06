import { hasImpossibleIsoCalendarDate, normalizeOptionalTimestamp } from './isoDate';

describe('isoDate guards', () => {
  it('rejects impossible ISO dates even when timezone follows immediately after the date', () => {
    expect(hasImpossibleIsoCalendarDate('2026-02-30T10:00:00.000Z')).toBe(true);
    expect(hasImpossibleIsoCalendarDate('2026-02-30Z')).toBe(true);
  });

  it('drops impossible timestamps during normalization', () => {
    expect(normalizeOptionalTimestamp('2026-02-30Z')).toBeUndefined();
  });

  it('keeps valid timestamps unchanged', () => {
    expect(normalizeOptionalTimestamp('2026-02-28T10:00:00.000Z')).toBe('2026-02-28T10:00:00.000Z');
  });
});
