import { isValidSignupPassword } from '../src/lib/passwordPolicy';

describe('signup password policy', () => {
  it('matches the server character and UTF-8 byte limits', () => {
    expect(isValidSignupPassword('12345678')).toBe(true);
    expect(isValidSignupPassword('1234567')).toBe(false);
    expect(isValidSignupPassword(`${'a'.repeat(70)}é`)).toBe(true);
    expect(isValidSignupPassword(`${'a'.repeat(71)}é`)).toBe(false);
  });

  it('rejects control and hidden formatting characters', () => {
    expect(isValidSignupPassword('1234\n678')).toBe(false);
    expect(isValidSignupPassword('1234\u200d6789')).toBe(false);
    expect(isValidSignupPassword('1234\u20286789')).toBe(false);
  });
});
