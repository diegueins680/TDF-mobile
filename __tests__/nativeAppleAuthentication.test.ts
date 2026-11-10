import { isAppleSignInEnabled, loadNativeAppleAuthentication } from '../src/lib/nativeAppleAuthentication';
const originalRollout = process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED;
afterAll(() => {
  if (originalRollout === undefined) delete process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED;
  else process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED = originalRollout;
});
it.each([undefined, '', 'false', 'TRUE', '1', ' true', 'true ', 'True'])('fails closed for rollout %s', async value => {
  if (value === undefined) delete process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED;
  else process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED = value;
  expect(isAppleSignInEnabled()).toBe(false);
  expect(await loadNativeAppleAuthentication()).toBeNull();
});
it('enables only the literal true build flag', () => {
  process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED = 'true';
  expect(isAppleSignInEnabled()).toBe(true);
});
