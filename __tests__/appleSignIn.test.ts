const mockGetRandomBytesAsync = jest.fn();
const mockDigestStringAsync = jest.fn();

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: (...args: unknown[]) => mockGetRandomBytesAsync(...args),
  digestStringAsync: (...args: unknown[]) => mockDigestStringAsync(...args),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
}));

import {
  APPLE_SIGN_IN_CANCELED_CODE,
  createAppleSignInNonce,
  isAppleSignInCancellation,
  isSignupConsentRequiredMessage,
  readAppleFullName,
} from '../src/lib/appleSignIn';

describe('createAppleSignInNonce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives a 32-byte hex raw nonce and hands Apple its SHA-256 hex digest', async () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, index) => index);
    mockGetRandomBytesAsync.mockResolvedValue(bytes);
    mockDigestStringAsync.mockResolvedValue('digest-of-raw-nonce');

    const nonce = await createAppleSignInNonce();

    expect(mockGetRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(nonce.rawNonce).toBe('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
    expect(nonce.rawNonce).toHaveLength(64);
    expect(mockDigestStringAsync).toHaveBeenCalledWith('SHA-256', nonce.rawNonce, { encoding: 'hex' });
    expect(nonce.hashedNonce).toBe('digest-of-raw-nonce');
  });

  it('never reuses a nonce across requests', async () => {
    mockGetRandomBytesAsync
      .mockResolvedValueOnce(Uint8Array.from({ length: 32 }, () => 0xff))
      .mockResolvedValueOnce(Uint8Array.from({ length: 32 }, () => 0x01));
    mockDigestStringAsync.mockImplementation(async (_algorithm: string, data: string) => `sha256:${data}`);

    const first = await createAppleSignInNonce();
    const second = await createAppleSignInNonce();

    expect(first.rawNonce).not.toBe(second.rawNonce);
    expect(first.hashedNonce).toBe(`sha256:${first.rawNonce}`);
    expect(second.hashedNonce).toBe(`sha256:${second.rawNonce}`);
  });
});

describe('isAppleSignInCancellation', () => {
  it('recognizes only the expo-apple-authentication cancel code', () => {
    expect(APPLE_SIGN_IN_CANCELED_CODE).toBe('ERR_REQUEST_CANCELED');
    expect(isAppleSignInCancellation({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
    expect(isAppleSignInCancellation(Object.assign(new Error('cancel'), { code: 'ERR_REQUEST_CANCELED' }))).toBe(true);
    expect(isAppleSignInCancellation({ code: 'ERR_REQUEST_FAILED' })).toBe(false);
    expect(isAppleSignInCancellation(new Error('ERR_REQUEST_CANCELED'))).toBe(false);
    expect(isAppleSignInCancellation(null)).toBe(false);
    expect(isAppleSignInCancellation('ERR_REQUEST_CANCELED')).toBe(false);
  });
});

describe('isSignupConsentRequiredMessage', () => {
  it('matches the backend consent prefix for either provider wording', () => {
    expect(isSignupConsentRequiredMessage(
      'Accept the terms and privacy policy through the signup flow before creating a Google account',
    )).toBe(true);
    expect(isSignupConsentRequiredMessage(
      'Accept the terms and privacy policy through the signup flow before creating an Apple account',
    )).toBe(true);
    expect(isSignupConsentRequiredMessage('Invalid or expired Apple token')).toBe(false);
    expect(isSignupConsentRequiredMessage('')).toBe(false);
  });
});

describe('readAppleFullName', () => {
  it('only forwards the name parts Apple actually returned', () => {
    expect(readAppleFullName(null)).toBeUndefined();
    expect(readAppleFullName({ givenName: null, familyName: null })).toBeUndefined();
    expect(readAppleFullName({ givenName: '  ', familyName: '' })).toBeUndefined();
    expect(readAppleFullName({ givenName: ' Diego ', familyName: null })).toEqual({ givenName: 'Diego' });
    expect(readAppleFullName({ givenName: 'Diego', familyName: 'Saá' })).toEqual({ givenName: 'Diego', familyName: 'Saá' });
  });
});
