const { device, element, by, waitFor, expect } = require('detox');
const { expect: assert } = require('@jest/globals');
// UI-only smoke: no provider consent, backend login or production data.
describe('Isolated native UI smoke', () => {
  beforeEach(async () => {
    // The runner creates a fresh simulator per run; these tests never submit credentials.
    // clearKeychain unloads securityd and destabilized SpringBoard on iOS 26.2.
    // Reinstall app data between cases without disrupting system security services.
    await device.launchApp({ delete: true, newInstance: true });
    await waitFor(element(by.id('onboardingScroll'))).toBeVisible().withTimeout(30000);
  });

  async function expectSubmissionEnabled(enabled) {
    await expect(element(by.id('loginButton'))).toExist();
    if (device.getPlatform() === 'ios') {
      // Fabric exposes accessibilityState.disabled as a trait, not UIControl.enabled.
      const disabledButton = element(by.id('loginButton').and(by.traits(['notEnabled'])));
      if (enabled) await expect(disabledButton).not.toExist();
      else await expect(disabledButton).toExist();
      return;
    }
    const attributes = await element(by.id('loginButton')).getAttributes();
    if ('elements' in attributes) throw new Error('loginButton must match exactly one element');
    assert(attributes.enabled).toBe(enabled);
  }

  async function openLogin() {
    // The historical goToLoginButton ID belongs to Create account.
    const login = element(by.label(/^(Ya tengo cuenta|I already have an account)$/));
    await waitFor(login).toBeVisible()
      .whileElement(by.id('onboardingScroll')).scroll(200, 'down');
    await login.tap();
    await waitFor(element(by.id('usernameInput'))).toBeVisible().withTimeout(15000);
  }

  it('opens login from fresh onboarding with empty fields', async () => {
    await openLogin();
    await expect(element(by.id('usernameInput'))).toHaveText('');
    await expect(element(by.id('passwordInput'))).toHaveText('');
    await expectSubmissionEnabled(false);
    await device.takeScreenshot('fresh-login');
  });

  it('requires both credentials before enabling password submission', async () => {
    await openLogin();
    await element(by.id('usernameInput')).replaceText('ui-fixture-not-an-account');
    await expectSubmissionEnabled(false);
    await element(by.id('passwordInput')).replaceText('synthetic-not-a-secret');
    await expectSubmissionEnabled(true);
    // Deliberately do not submit: backend behavior is a separate qualification.
  });

  it('does not persist unsubmitted credentials after a cold restart', async () => {
    await openLogin();
    await element(by.id('usernameInput')).replaceText('ui-fixture-not-an-account');
    await element(by.id('passwordInput')).replaceText('synthetic-not-a-secret');
    await device.terminateApp();
    await device.launchApp({ newInstance: true });
    // Expo Linking consumes the native URL callback, not Detox's launch-option override.
    // This checks process-restart form state plus an explicit URL event, not external cold links.
    await device.openURL({ url: 'tdf://auth' });
    await waitFor(element(by.id('usernameInput'))).toBeVisible().withTimeout(15000);
    await expect(element(by.id('usernameInput'))).toHaveText('');
    await expect(element(by.id('passwordInput'))).toHaveText('');
    await expectSubmissionEnabled(false);
    await device.takeScreenshot('cold-restart-login');
  });
});
