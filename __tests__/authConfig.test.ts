const ORIGINAL_ENV = { ...process.env };

const resetGoogleEnv = () => {
  delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  delete process.env.GOOGLE_IOS_URL_SCHEME;
};

const loadAuthConfig = async (constantsMock: unknown, env: Record<string, string> = {}) => {
  jest.resetModules();
  resetGoogleEnv();
  Object.assign(process.env, env);
  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: constantsMock,
  }));

  return require('../src/lib/authConfig');
};

describe('authConfig', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('expo-constants');
    process.env = { ...ORIGINAL_ENV };
  });

  it('falls back to expo config extra when public env vars are missing', async () => {
    const authConfig = await loadAuthConfig({
      expoConfig: {
        extra: {
          googleAuth: {
            webClientId: 'expo-web.apps.googleusercontent.com',
            iosClientId: 'expo-ios.apps.googleusercontent.com',
            iosUrlScheme: 'com.googleusercontent.apps.expo-ios',
          },
        },
      },
    });

    expect(authConfig.GOOGLE_WEB_CLIENT_ID).toBe('expo-web.apps.googleusercontent.com');
    expect(authConfig.GOOGLE_IOS_CLIENT_ID).toBe('expo-ios.apps.googleusercontent.com');
    expect(authConfig.GOOGLE_IOS_URL_SCHEME).toBe('com.googleusercontent.apps.expo-ios');
  });

  it('falls back to legacy manifest extra when expoConfig is unavailable', async () => {
    const authConfig = await loadAuthConfig({
      manifest: {
        extra: {
          googleAuth: {
            webClientId: 'legacy-web.apps.googleusercontent.com',
          },
        },
      },
    });

    expect(authConfig.GOOGLE_WEB_CLIENT_ID).toBe('legacy-web.apps.googleusercontent.com');
  });

  it('prefers public env vars over embedded expo config values', async () => {
    const authConfig = await loadAuthConfig(
      {
        expoConfig: {
          extra: {
            googleAuth: {
              webClientId: 'embedded-web.apps.googleusercontent.com',
            },
          },
        },
      },
      {
        EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'env-web.apps.googleusercontent.com',
      },
    );

    expect(authConfig.GOOGLE_WEB_CLIENT_ID).toBe('env-web.apps.googleusercontent.com');
  });

  it('accepts the non-public GOOGLE_IOS_URL_SCHEME env used by app.config.ts', async () => {
    const authConfig = await loadAuthConfig(
      {
        expoConfig: {
          extra: {
            googleAuth: {
              iosUrlScheme: 'embedded-ios-scheme',
            },
          },
        },
      },
      {
        GOOGLE_IOS_URL_SCHEME: 'com.googleusercontent.apps.env-ios',
      },
    );

    expect(authConfig.GOOGLE_IOS_URL_SCHEME).toBe('com.googleusercontent.apps.env-ios');
  });
});
