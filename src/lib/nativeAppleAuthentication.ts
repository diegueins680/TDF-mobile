import { Platform } from 'react-native';

type AppleAuthenticationModule = typeof import('expo-apple-authentication');

/**
 * The subset of `expo-apple-authentication` the auth screen relies on. The module is loaded
 * lazily (like Google Sign-In) so Expo Go, Android and web never evaluate the native binding.
 */
export type NativeAppleAuthenticationModule = Pick<
  AppleAuthenticationModule,
  | 'isAvailableAsync'
  | 'signInAsync'
  | 'AppleAuthenticationButton'
  | 'AppleAuthenticationButtonType'
  | 'AppleAuthenticationButtonStyle'
  | 'AppleAuthenticationScope'
>;

let cachedModule: NativeAppleAuthenticationModule | null | undefined;

export async function loadNativeAppleAuthentication(): Promise<NativeAppleAuthenticationModule | null> {
  if (Platform.OS !== 'ios') return null;
  if (cachedModule !== undefined) return cachedModule;

  try {
    cachedModule = await import('expo-apple-authentication');
  } catch {
    cachedModule = null;
  }

  return cachedModule;
}
