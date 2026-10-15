import * as Crypto from 'expo-crypto';

export type AppleSignInNonce = {
  /** Random value sent to the TDF backend so it can verify the token was minted for this request. */
  rawNonce: string;
  /** SHA-256 hex digest of `rawNonce`; this is what Apple embeds in the identity token. */
  hashedNonce: string;
};

export type AppleSignInFullName = {
  givenName?: string;
  familyName?: string;
};

const APPLE_NONCE_BYTE_LENGTH = 32;

export const APPLE_SIGN_IN_CANCELED_CODE = 'ERR_REQUEST_CANCELED';

// The backend answers with this prefix when a verified social identity is not bound to any
// TDF account and the caller did not explicitly ask to create one. The wording ends with the
// provider name, so only the shared prefix is matched.
const SIGNUP_CONSENT_REQUIRED_PREFIX = 'Accept the terms and privacy policy through the signup flow';

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export async function createAppleSignInNonce(): Promise<AppleSignInNonce> {
  const rawNonce = toHex(await Crypto.getRandomBytesAsync(APPLE_NONCE_BYTE_LENGTH));
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
  return { rawNonce, hashedNonce };
}

export const isAppleSignInCancellation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === APPLE_SIGN_IN_CANCELED_CODE;

export const isSignupConsentRequiredMessage = (message: string): boolean =>
  message.trim().startsWith(SIGNUP_CONSENT_REQUIRED_PREFIX);

/**
 * Apple only returns the name on the first authorization for an app; later credentials carry
 * nulls. Returns `undefined` when there is nothing worth sending.
 */
export const readAppleFullName = (
  fullName: { givenName?: string | null; familyName?: string | null } | null | undefined,
): AppleSignInFullName | undefined => {
  const givenName = fullName?.givenName?.trim();
  const familyName = fullName?.familyName?.trim();
  if (!givenName && !familyName) return undefined;
  return {
    ...(givenName ? { givenName } : {}),
    ...(familyName ? { familyName } : {}),
  };
};
