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

// Public build-time rollout switch; only the literal enabled value admits this optional flow.
export const isAppleSignInEnabled = (): boolean => process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true';

let cachedModule: NativeAppleAuthenticationModule | null | undefined;

export async function loadNativeAppleAuthentication(): Promise<NativeAppleAuthenticationModule | null> {
  if (!isAppleSignInEnabled() || Platform.OS !== 'ios') return null;
  if (cachedModule !== undefined) return cachedModule;

  try {
    cachedModule = await import('expo-apple-authentication');
  } catch {
    cachedModule = null;
  }

  return cachedModule;
}
