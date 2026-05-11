describe('Login Screen', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should type text into username input', async () => {
    await element(by.id('usernameInput')).typeText('tdf-owner');
  });
});
