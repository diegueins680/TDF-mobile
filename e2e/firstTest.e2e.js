describe('Login Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ launchArgs: { detoxDisableSynchronization: true } });
  });

  it('should complete username/password login flow', async () => {
    // If onboarding is visible, tap through it; otherwise proceed directly to login.
    try {
      await waitFor(element(by.id('goToLoginButton'))).toBeVisible().withTimeout(3000);
      await element(by.id('goToLoginButton')).tap();
    } catch (_e) {
      // onboarding already seen or not visible — proceed with login fields
    }
    await waitFor(element(by.id('usernameInput'))).toBeVisible().withTimeout(5000);
    await element(by.id('usernameInput')).typeText('tdf-owner');
    await element(by.id('passwordInput')).typeText('TDFowner2025!');
    await element(by.id('loginButton')).tap();
    await expect(element(by.text('Buscar'))).toBeVisible();
  }, 60000);
});