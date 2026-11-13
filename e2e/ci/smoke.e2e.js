const { device, element, by, waitFor, expect } = require('detox');
const { expect: assert } = require('@jest/globals');
// UI-only smoke: no provider consent, backend login or production data.
describe('Isolated native UI smoke', () => {
  beforeEach(async () => {
    if (device.getPlatform() === 'ios') await device.clearKeychain();
    await device.launchApp({ delete: true, newInstance: true });
    await waitFor(element(by.id('onboardingPanel'))).toBeVisible().withTimeout(30000);
  });

  async function expectSubmissionEnabled(enabled) {
    const attributes = await element(by.id('loginButton')).getAttributes();
    if ('elements' in attributes) throw new Error('loginButton must match exactly one element');
    assert(attributes.enabled).toBe(enabled);
  }

  async function openLogin() {
    await waitFor(element(by.id('goToLoginButton'))).toBeVisible()
      .whileElement(by.id('onboardingScroll')).scroll(200, 'down');
    await element(by.id('goToLoginButton')).tap();
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
    await device.launchApp({ newInstance: true, url: 'tdf://auth' });
    await waitFor(element(by.id('usernameInput'))).toBeVisible().withTimeout(15000);
    await expect(element(by.id('usernameInput'))).toHaveText('');
    await expect(element(by.id('passwordInput'))).toHaveText('');
    await expectSubmissionEnabled(false);
    await device.takeScreenshot('cold-restart-login');
  });
});
