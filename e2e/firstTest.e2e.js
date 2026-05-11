describe('Login Screen', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should complete username/password login flow', async () => {
    await element(by.id('usernameInput')).typeText('tdf-owner');
    await element(by.id('passwordInput')).typeText('TDFowner2025!');
    await element(by.id('loginButton')).tap();
    await expect(element(by.text('Buscar'))).toBeVisible();
  });
});
