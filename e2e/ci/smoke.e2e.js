const { device, element, by, waitFor, expect } = require('detox');
const { expect: assert } = require('@jest/globals');
const { execFileSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const path = require('node:path');
let accessibilitySnapshot = 0;
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
    // RN maps accessibilityState.disabled to AccessibilityNodeInfo, not View.isEnabled.
    // Read that native state and retain the exact hierarchy used by the assertion.
    const evidence = process.env.TDF_UI_EVIDENCE;
    if (!evidence) throw new Error('TDF_UI_EVIDENCE is required');
    const remote = '/data/local/tmp/tdf-login-accessibility.xml';
    const adb = (...args) => execFileSync('adb', ['-s', device.id, ...args], {
      encoding: 'utf8', timeout: 15000,
    });
    assert(device.id).toBe('emulator-5554');
    adb('shell', 'rm', '-f', remote);
    adb('shell', 'uiautomator', 'dump', remote);
    const xml = adb('exec-out', 'cat', remote);
    writeFileSync(path.join(evidence, `android-accessibility-${++accessibilitySnapshot}.xml`), xml);
    const nodes = (xml.match(/<node\b[^>]*>/g) || [])
      .filter(node => /\bresource-id="loginButton"/.test(node));
    assert(nodes).toHaveLength(1);
    const state = nodes[0].match(/\benabled="(true|false)"/);
    assert(state).not.toBeNull();
    assert(state[1]).toBe(String(enabled));
  }

  async function openLogin() {
    // The historical goToLoginButton ID belongs to Create account.
    const label = by.label(/^(Ya tengo cuenta|I already have an account)$/);
    // Android matches both the accessible button and its TextView child by label.
    const login = element(device.getPlatform() === 'android'
      ? label.and(by.type('com.facebook.react.views.view.ReactViewGroup'))
      : label);
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
