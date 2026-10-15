import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform, Text, TouchableOpacity } from 'react-native';

const mockSetToken = jest.fn();
const mockClearToken = jest.fn();
const mockLoginRequest = jest.fn();
const mockRequestPasswordReset = jest.fn();
const mockGoogleLoginRequest = jest.fn();
const mockSignupRequest = jest.fn();
const mockGoogleHasPlayServices = jest.fn();
const mockGoogleSignIn = jest.fn();
const mockGoogleSignOut = jest.fn();
const mockLoadNativeGoogleSignin = jest.fn();
const mockAppleLoginRequest = jest.fn();
const mockAppleIsAvailable = jest.fn();
const mockAppleSignIn = jest.fn();
const mockLoadNativeAppleAuthentication = jest.fn();
const mockReplace = jest.fn();
const mockClearPendingOnboardingIntent = jest.fn();
const mockPersistOnboardingIntent = jest.fn();
const mockReadPendingOnboardingIntent = jest.fn(() => Promise.resolve(null));
const mockUpdateOnboardingIntent = jest.fn();
const mockIsCurrentAuthToken = jest.fn();
const mockOpenURL = jest.spyOn(Linking, 'openURL');
let mockAuthConfig = {
  GOOGLE_WEB_CLIENT_ID: 'web-client-id.apps.googleusercontent.com',
  GOOGLE_IOS_CLIENT_ID: 'ios-client-id.apps.googleusercontent.com',
  GOOGLE_IOS_URL_SCHEME: 'com.googleusercontent.apps.123456',
};
let mockLocale = 'es';
let mockSearchParams: Record<string, string> = {};
let mockStoredValues = new Map<string, string>();

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({
    token: null,
    partyId: null,
    loading: false,
    setToken: mockSetToken,
    clearToken: mockClearToken,
  })),
}));

jest.mock('../src/providers/UserSettingsProvider', () => ({
  useUserSettings: () => ({
    locale: mockLocale,
    getCatalogItems: () => [
      { id: 'locale-es', code: 'es' },
      { id: 'locale-en', code: 'en' },
    ],
    setRegionalPreferences: jest.fn(),
  }),
}));

jest.mock('../src/theme/ThemeProvider', () => {
  return {
    useAppTheme: () => ({
      colorScheme: 'light',
      preference: 'system',
      preferenceId: 'appearance-system',
      options: [],
      catalogSource: 'network',
      colors: {
        canvas: '#f8fafc',
        surface: '#f1f5f9',
        surfaceRaised: '#ffffff',
        textPrimary: '#0f172a',
        textSecondary: '#475569',
        border: '#94949a',
        actionPrimary: '#7c3aed',
        actionPrimaryPressed: '#6d28d9',
        actionPrimaryContrast: '#ffffff',
        selected: '#ede9fe',
        danger: '#b91c1c',
        success: '#166534',
      },
      setPreferenceById: jest.fn(),
    }),
  };
});

jest.mock('../src/api/auth', () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  loginRequest: (...args: unknown[]) => mockLoginRequest(...args),
  googleLoginRequest: (...args: unknown[]) => mockGoogleLoginRequest(...args),
  appleLoginRequest: (...args: unknown[]) => mockAppleLoginRequest(...args),
  signupRequest: (...args: unknown[]) => mockSignupRequest(...args),
}));

jest.mock('../src/api/onboarding', () => ({
  updateOnboardingIntent: (...args: unknown[]) => mockUpdateOnboardingIntent(...args),
}));

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  isCurrentAuthToken: (...args: unknown[]) => mockIsCurrentAuthToken(...args),
}));

jest.mock('../src/lib/authConfig', () => ({
  __esModule: true,
  get GOOGLE_WEB_CLIENT_ID() {
    return mockAuthConfig?.GOOGLE_WEB_CLIENT_ID;
  },
  get GOOGLE_IOS_CLIENT_ID() {
    return mockAuthConfig?.GOOGLE_IOS_CLIENT_ID;
  },
  get GOOGLE_IOS_URL_SCHEME() {
    return mockAuthConfig?.GOOGLE_IOS_URL_SCHEME;
  },
}));

jest.mock('../src/lib/nativeGoogleSignin', () => ({
  loadNativeGoogleSignin: () => mockLoadNativeGoogleSignin(),
}));

jest.mock('../src/lib/nativeAppleAuthentication', () => ({
  loadNativeAppleAuthentication: () => mockLoadNativeAppleAuthentication(),
}));

// Deterministic nonce material so the test can assert what Apple and the backend receive.
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (length: number) => Uint8Array.from({ length }, () => 0xab),
  digestStringAsync: async (_algorithm: string, data: string) => `sha256:${data}`,
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
}));

const APPLE_RAW_NONCE = 'ab'.repeat(32);
const APPLE_HASHED_NONCE = `sha256:${APPLE_RAW_NONCE}`;

type FakeAppleButtonProps = { onPress: () => void; testID?: string; buttonType: number };
const FakeAppleAuthenticationButton = ({ onPress, testID, buttonType }: FakeAppleButtonProps) => (
  <TouchableOpacity onPress={onPress} testID={testID} accessibilityRole="button">
    <Text>{buttonType === 2 ? 'Sign up with Apple' : 'Sign in with Apple'}</Text>
  </TouchableOpacity>
);

const fakeAppleAuthenticationModule = {
  isAvailableAsync: (...args: unknown[]) => mockAppleIsAvailable(...args),
  signInAsync: (...args: unknown[]) => mockAppleSignIn(...args),
  AppleAuthenticationButton: FakeAppleAuthenticationButton,
  AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
  AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
};

jest.mock('../src/lib/onboardingIntent', () => {
  const actual = jest.requireActual('../src/lib/onboardingIntent');
  return {
    ...actual,
    clearPendingOnboardingIntent: (...args: unknown[]) => mockClearPendingOnboardingIntent(...args),
    persistOnboardingIntent: (...args: unknown[]) => mockPersistOnboardingIntent(...args),
    readPendingOnboardingIntent: () => mockReadPendingOnboardingIntent(),
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockSearchParams,
}));

const AuthScreen = require('../app/auth').default;

describe('Auth screen', () => {
  beforeEach(() => {
  mockLocale = 'es';
    jest.clearAllMocks();
    mockStoredValues = new Map();
    jest.mocked(AsyncStorage.getItem).mockReset().mockImplementation(async (key) =>
      mockStoredValues.get(key) ?? null);
    jest.mocked(AsyncStorage.setItem).mockReset().mockImplementation(async (key, value) => {
      mockStoredValues.set(key, value);
    });
    jest.mocked(AsyncStorage.removeItem).mockReset().mockImplementation(async (key) => {
      mockStoredValues.delete(key);
    });
    mockReadPendingOnboardingIntent.mockResolvedValue(null);
    mockPersistOnboardingIntent.mockImplementation(async (intent: string) => {
      mockStoredValues.set('tdf-onboarding-intent:pending', intent);
    });
    mockUpdateOnboardingIntent.mockResolvedValue({ eligible: false });
    mockIsCurrentAuthToken.mockReturnValue(true);
    mockOpenURL.mockResolvedValue(undefined);
    mockSearchParams = {};
    mockReplace.mockReset();
    mockAuthConfig.GOOGLE_WEB_CLIENT_ID = 'web-client-id.apps.googleusercontent.com';
    mockAuthConfig.GOOGLE_IOS_CLIENT_ID = 'ios-client-id.apps.googleusercontent.com';
    mockAuthConfig.GOOGLE_IOS_URL_SCHEME = 'com.googleusercontent.apps.123456';
    mockGoogleHasPlayServices.mockResolvedValue(true);
    mockGoogleSignOut.mockResolvedValue(null);
    mockAppleIsAvailable.mockResolvedValue(true);
    mockLoadNativeAppleAuthentication.mockResolvedValue(fakeAppleAuthenticationModule);
    mockLoadNativeGoogleSignin.mockResolvedValue({
      GoogleSignin: {
        configure: jest.fn(),
        hasPlayServices: (...args: unknown[]) => mockGoogleHasPlayServices(...args),
        signIn: (...args: unknown[]) => mockGoogleSignIn(...args),
        signOut: (...args: unknown[]) => mockGoogleSignOut(...args),
      },
      isErrorWithCode: (error: unknown) => typeof error === 'object' && error !== null && 'code' in error,
      isSuccessResponse: (response: { type?: string }) => response.type === 'success',
      statusCodes: {
        SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
        IN_PROGRESS: 'IN_PROGRESS',
        PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
      },
    });
  });

  it.each(['es', 'en', 'fr'])('requests recovery in the supported UI language for %s', async (locale) => {
    mockLocale = locale;
    mockRequestPasswordReset.mockResolvedValue(undefined);
    render(<AuthScreen />);
    fireEvent.press(screen.getByText(locale !== 'en' ? '¿Olvidaste tu contraseña?' : 'Forgot your password?'));
    fireEvent.changeText(screen.getByLabelText(locale !== 'en' ? 'Correo electrónico' : 'Email'), 'Recovery@Example.test');
    fireEvent.press(screen.getByText(locale !== 'en' ? 'Enviar enlace' : 'Send link'));
    await waitFor(() => expect(mockRequestPasswordReset).toHaveBeenCalledWith('recovery@example.test', locale !== 'en' ? 'es' : 'en'));
  });

  it('submits username/password login and stores the returned token', async () => {
    mockLoginRequest.mockResolvedValue({
      token: 'Bearer mobile-token',
      partyId: 42,
      roles: [],
      modules: [],
    });

    render(<AuthScreen />);

    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'demo-user');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'demo-pass');
    expect(screen.getByDisplayValue('demo-user')).toBeTruthy();
    expect(screen.getByDisplayValue('demo-pass')).toBeTruthy();

    fireEvent.press(screen.getByTestId('loginButton'));

    await waitFor(() => {
      expect(mockLoginRequest).toHaveBeenCalledWith({
        username: 'demo-user',
        password: 'demo-pass',
      });
      expect(mockSetToken).toHaveBeenCalledWith('Bearer mobile-token', 42, { roles: [], modules: [] });
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/directory');
    });
    expect(mockClearPendingOnboardingIntent).not.toHaveBeenCalled();
    expect(await screen.findByText('Sesión iniciada.')).toBeTruthy();
  }, 10_000);

  it('never prepopulates a username or password in development builds', async () => {
    render(<AuthScreen />);

    expect(screen.getByTestId('usernameInput').props.value).toBe('');
    expect(screen.getByTestId('passwordInput').props.value).toBe('');
    expect(screen.getByTestId('loginButton').props.accessibilityState).toEqual({
      disabled: true,
      busy: false,
    });
    await waitFor(() => expect(mockLoadNativeGoogleSignin).toHaveBeenCalled());
  });

  it('drops a syntactically safe returnTo when the returned session cannot use it', async () => {
    mockSearchParams = { returnTo: '/access-requests/review' };
    mockLoginRequest.mockResolvedValue({ token: 'token', partyId: 5, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'customer');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'password');
    fireEvent.press(screen.getByTestId('loginButton'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/directory'));
  });

  it('resumes an authorized internal route with its event query intact', async () => {
    mockSearchParams = {
      intent: 'professional_tools',
      returnTo: '/ticketCheckout?eventId=42',
    };
    mockLoginRequest.mockResolvedValue({ token: 'token', partyId: 5, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'customer');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'password');
    fireEvent.press(screen.getByTestId('loginButton'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/ticketCheckout?eventId=42'));
    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  it('opens the public music maker after professional-tools login', async () => {
    mockSearchParams = { intent: 'professional_tools' };
    mockLoginRequest.mockResolvedValue({ token: 'token', partyId: 5, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'customer');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'password');
    fireEvent.press(screen.getByTestId('loginButton'));

    await waitFor(() => expect(mockOpenURL).toHaveBeenCalledWith(
      'https://www.tdfrecords.net/herramientas/creador-musical',
    ));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/directory');
  });

  it('rejects an external return target before session authorization', async () => {
    mockSearchParams = { returnTo: '//evil.example/tickets' };
    mockLoginRequest.mockResolvedValue({ token: 'token', partyId: 5, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'customer');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'password');
    fireEvent.press(screen.getByTestId('loginButton'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/directory'));
  });

  it('returns to a canonical public event after an existing user logs in', async () => {
    mockSearchParams = { mode: 'signup', intent: 'events', returnTo: '/eventos/42' };
    mockLoginRequest.mockResolvedValue({ token: 'token', partyId: 5, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.press(screen.getByText('Ingresar'));
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'customer');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'password');
    fireEvent.press(screen.getByTestId('loginButton'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/eventos/42'));
  });

  it('rejects external and backslash return routes', async () => {
    mockSearchParams = { returnTo: '/\\evil.example/path' };
    mockLoginRequest.mockResolvedValue({ token: 'token', partyId: 5, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'customer');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'password');
    fireEvent.press(screen.getByTestId('loginButton'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/directory'));
  });

  it('strips untrusted parameters from an otherwise valid public event return route', async () => {
    mockSearchParams = { returnTo: '/eventos/42?token=secret&partyId=7' };
    mockLoginRequest.mockResolvedValue({ token: 'token', partyId: 5, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'customer');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'password');
    fireEvent.press(screen.getByTestId('loginButton'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/eventos/42'));
  });

  it('exposes associated field labels, input guidance, and validation errors', async () => {
    render(<AuthScreen />);
    await waitFor(() => expect(mockLoadNativeGoogleSignin).toHaveBeenCalled());

    expect(screen.getByLabelText('Usuario o correo')).toBeTruthy();
    expect(screen.getByLabelText('Contraseña')).toBeTruthy();
    expect(screen.getByTestId('loginButton').props.accessibilityState).toEqual({
      disabled: true,
      busy: false,
    });

    fireEvent.press(screen.getByText('Crear cuenta'));
    const emailInput = screen.getByLabelText('Correo electrónico');
    const passwordInput = screen.getByLabelText('Contraseña');

    expect(emailInput).toBeTruthy();
    expect(passwordInput.props.accessibilityHint).toBe(
      'Usa al menos 8 caracteres y como máximo 72 bytes UTF-8, sin caracteres de control ni formato oculto.',
    );

    fireEvent.changeText(emailInput, 'correo-invalido');
    fireEvent.changeText(passwordInput, 'corta');

    expect(screen.getByText('Ingresa un correo electrónico válido.').props.accessibilityRole).toBe('alert');
    expect(screen.getByText(
      'Usa al menos 8 caracteres y como máximo 72 bytes UTF-8, sin caracteres de control ni formato oculto.',
    ).props.accessibilityRole).toBe('alert');
  });

  it('links signup consent to the account policy recorded by its terms version', async () => {
    render(<AuthScreen />);
    await screen.findByText(/Continuar con Google/i);
    fireEvent.press(screen.getByText('Crear cuenta'));

    fireEvent.press(screen.getByRole('link', { name: 'Ver términos' }));
    fireEvent.press(screen.getByRole('link', { name: 'Ver privacidad' }));

    expect(mockOpenURL).toHaveBeenNthCalledWith(
      1,
      'https://www.tdfrecords.net/account/terms-es.html',
    );
    expect(mockOpenURL).toHaveBeenNthCalledWith(
      2,
      'https://www.tdfrecords.net/account/privacy-es.html',
    );
  });

  it('keeps the original policy URLs for English signup', async () => {
    mockLocale = 'en';
    mockSearchParams = { mode: 'signup' };
    render(<AuthScreen />);
    fireEvent.press(await screen.findByRole('link', { name: 'View terms' }));
    fireEvent.press(screen.getByRole('link', { name: 'View privacy' }));
    expect(mockOpenURL).toHaveBeenNthCalledWith(1, 'https://www.tdfrecords.net/account/terms.html');
    expect(mockOpenURL).toHaveBeenNthCalledWith(2, 'https://www.tdfrecords.net/account/privacy.html');
  });

  it('preserves signup input and offers a retry when a policy document cannot open', async () => {
    mockSearchParams = { mode: 'signup' };
    mockOpenURL.mockRejectedValueOnce(new Error('browser unavailable'));
    render(<AuthScreen />);
    const email = await screen.findByPlaceholderText('tu@correo.com');
    fireEvent.changeText(email, 'synthetic@example.test');
    fireEvent.press(screen.getByRole('link', { name: 'Ver términos' }));
    const failureCopy = 'No pudimos abrir el documento. Toca el enlace para volver a intentarlo; tus datos siguen aquí.';
    const message = await screen.findByText(failureCopy);
    expect(message.props.accessibilityRole).toBe('alert');
    expect(screen.getByDisplayValue('synthetic@example.test')).toBeTruthy();
    expect(mockSignupRequest).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('link', { name: 'Ver términos' }));
    await waitFor(() => expect(screen.queryByText(failureCopy)).toBeNull());
    expect(mockOpenURL).toHaveBeenCalledTimes(2);
    expect(mockOpenURL).toHaveBeenLastCalledWith('https://www.tdfrecords.net/account/terms-es.html');
  });

  it('creates an account without caller-selected roles and stores the returned session', async () => {
    mockSignupRequest.mockResolvedValue({
      token: 'Bearer new-fan-token',
      partyId: 88,
      roles: ['Fan'],
      modules: [],
    });

    render(<AuthScreen />);
    fireEvent.press(screen.getByText('Crear cuenta'));
    fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), 'Ana');
    fireEvent.changeText(screen.getByPlaceholderText('Tu apellido'), 'Paz');
    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'ANA@example.com');
    fireEvent.changeText(screen.getByPlaceholderText(/Mínimo 8 caracteres/i), 'password-seguro');
    fireEvent.press(screen.getByTestId('termsCheckbox'));
    fireEvent.press(screen.getByTestId('signupButton'));

    await waitFor(() => expect(mockSignupRequest).toHaveBeenCalledWith({
      firstName: 'Ana',
      lastName: 'Paz',
      email: 'ana@example.com',
      password: 'password-seguro',
      marketingOptIn: false,
      termsAccepted: true,
      termsVersion: 'tdf-account-terms-v1',
      onboardingIntent: 'events',
    }));
    await waitFor(() => expect(mockClearPendingOnboardingIntent).toHaveBeenCalledTimes(1));
    expect(mockSetToken).toHaveBeenCalledWith('Bearer new-fan-token', 88, { roles: ['Fan'], modules: [] });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/directory');
  });

  it('uses product intent for the next step without sending it as a security role', async () => {
    mockSignupRequest.mockResolvedValue({ token: 'token', partyId: 91, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.press(screen.getByText('Crear cuenta'));
    fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), 'Lina');
    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'lina@example.com');
    fireEvent.changeText(screen.getByPlaceholderText(/Mínimo 8 caracteres/i), 'password-seguro');
    fireEvent.press(screen.getByText('Crear perfil de artista'));
    fireEvent.press(screen.getByTestId('termsCheckbox'));
    fireEvent.press(screen.getByTestId('signupButton'));

    await waitFor(() => expect(mockSignupRequest).toHaveBeenCalled());
    expect(mockSignupRequest.mock.calls[0]?.[0]).not.toHaveProperty('roles');
    expect(mockSignupRequest.mock.calls[0]?.[0]).toHaveProperty('onboardingIntent', 'artist_profile');
    await waitFor(() => expect(mockClearPendingOnboardingIntent).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/createArtistProfile');
  });

  it('restores an interrupted signup intent from bounded local storage', async () => {
    mockSearchParams = { mode: 'signup' };
    mockReadPendingOnboardingIntent.mockResolvedValueOnce('artist_profile');
    mockSignupRequest.mockResolvedValue({ token: 'token', partyId: 92, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);

    await waitFor(() => expect(
      screen.getByRole('radio', { name: 'Crear perfil de artista' }).props.accessibilityState,
    ).toEqual({ selected: true }));
    fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), 'Lina');
    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'lina@example.com');
    fireEvent.changeText(screen.getByPlaceholderText(/Mínimo 8 caracteres/i), 'password-seguro');
    fireEvent.press(screen.getByTestId('termsCheckbox'));
    fireEvent.press(screen.getByTestId('signupButton'));

    await waitFor(() => expect(mockSignupRequest).toHaveBeenCalledWith(expect.objectContaining({
      onboardingIntent: 'artist_profile',
    })));
  });

  it('submits Google login and stores the returned token', async () => {
    mockGoogleSignIn.mockResolvedValue({
      type: 'success',
      data: {
        user: {
          id: 'user-1',
          name: 'Demo User',
          email: 'demo@example.com',
          photo: null,
          familyName: 'User',
          givenName: 'Demo',
        },
        scopes: [],
        idToken: 'google-id-token',
        serverAuthCode: null,
      },
    });
    mockGoogleLoginRequest.mockResolvedValue({
      token: 'Bearer google-mobile-token',
      partyId: 77,
      roles: [],
      modules: [],
    });

    render(<AuthScreen />);

    const googleButton = (await screen.findByText(/Continuar con Google/i)).parent;
    if (!googleButton) throw new Error('Google button not found');
    fireEvent.press(googleButton);

    await waitFor(() => expect(mockGoogleSignIn).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockGoogleLoginRequest).toHaveBeenCalledWith({ idToken: 'google-id-token' })
    );
    await waitFor(() => expect(mockSetToken).toHaveBeenCalledWith('Bearer google-mobile-token', 77, { roles: [], modules: [] }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/directory'));
    expect(mockClearPendingOnboardingIntent).not.toHaveBeenCalled();
    expect(screen.getByText('Sesión con Google iniciada.')).toBeTruthy();
  });

  it('connects Google only after an explicit existing-account password confirmation', async () => {
    mockGoogleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'verified-google-token' } });
    mockGoogleLoginRequest.mockRejectedValueOnce(new Error('Accept the terms and privacy policy through the signup flow before creating a Google account'))
      .mockResolvedValueOnce({ token: 'linked-token', partyId: 88, roles: [], modules: [], accountCreated: false });
    render(<AuthScreen />);
    fireEvent.press(await screen.findByText('Continuar con Google'));
    await screen.findByText('Conectar Google a mi cuenta TDF');
    expect(mockSetToken).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByPlaceholderText('usuario o correo'), 'existing-user');
    fireEvent.changeText(screen.getByPlaceholderText('Tu contraseña'), 'existing-password');
    fireEvent.press(screen.getByText('Conectar Google a mi cuenta TDF'));
    await waitFor(() => expect(mockGoogleLoginRequest).toHaveBeenLastCalledWith({
      idToken: 'verified-google-token', linkAccount: { username: 'existing-user', password: 'existing-password' },
    }));
    await waitFor(() => expect(mockSetToken).toHaveBeenCalled());
  });

  it('uses and retains a restored intent when Google persistence fails', async () => {
    mockReadPendingOnboardingIntent.mockResolvedValue('internships');
    mockUpdateOnboardingIntent.mockRejectedValueOnce(new Error('offline'));
    mockGoogleSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-login-token' },
    });
    mockGoogleLoginRequest.mockResolvedValue({
      token: 'Bearer existing-token',
      partyId: 76,
      roles: ['Customer'],
      modules: [],
      accountCreated: false,
    });

    render(<AuthScreen />);
    const googleButton = (await screen.findByText(/Continuar con Google/i)).parent;
    if (!googleButton) throw new Error('Google button not found');
    fireEvent.press(googleButton);

    await waitFor(() => expect(mockUpdateOnboardingIntent).toHaveBeenCalledWith('internships'));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'tdf-onboarding-intent:party:76',
      'internships',
    );
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('tdf-onboarding-intent:party:76');
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/access-requests/new',
      params: { feature: 'internships', action: 'view' },
    });
  });

  it('sends onboarding intent for Google signup and clears it after success', async () => {
    mockGoogleSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-signup-token' },
    });
    mockGoogleLoginRequest.mockResolvedValue({
      token: 'Bearer created-token',
      partyId: 78,
      roles: ['Customer'],
      modules: [],
      accountCreated: true,
    });
    mockSearchParams = { mode: 'signup', intent: 'follow_artists' };

    render(<AuthScreen />);
    fireEvent.press(await screen.findByTestId('termsCheckbox'));
    const googleButton = screen.getByText(/cuenta con Google/i).parent;
    if (!googleButton) throw new Error('Google button not found');
    fireEvent.press(googleButton);

    await waitFor(() => expect(mockGoogleLoginRequest).toHaveBeenCalledWith({
      idToken: 'google-signup-token',
      marketingOptIn: false,
      termsAccepted: true,
      termsVersion: 'tdf-account-terms-v1',
      createNewAccount: true,
      onboardingIntent: 'follow_artists',
    }));
    await waitFor(() => expect(mockClearPendingOnboardingIntent).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/social');
  });

  it('persists explicit product intent after existing-account login', async () => {
    mockSearchParams = { intent: 'follow_artists' };
    mockLoginRequest.mockResolvedValue({ token: 'token', partyId: 79, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'demo-user');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'demo-pass');
    fireEvent.press(screen.getByTestId('loginButton'));

    await waitFor(() => expect(mockUpdateOnboardingIntent).toHaveBeenCalledWith('follow_artists'));
    await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      'tdf-onboarding-intent:party:79',
    ));
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('tdf-onboarding-intent:pending');
    expect(mockIsCurrentAuthToken).toHaveBeenCalledWith('token');
    expect(mockPersistOnboardingIntent).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/social');
  });

  it('retains a validated pending intent when authenticated persistence fails', async () => {
    mockSearchParams = { intent: 'follow_artists' };
    mockUpdateOnboardingIntent.mockRejectedValueOnce(new Error('offline'));
    mockLoginRequest.mockResolvedValue({ token: 'token', partyId: 80, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'demo-user');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'demo-pass');
    fireEvent.press(screen.getByTestId('loginButton'));

    await waitFor(() => expect(mockUpdateOnboardingIntent).toHaveBeenCalledWith('follow_artists'));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'tdf-onboarding-intent:party:80',
      'follow_artists',
    );
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('tdf-onboarding-intent:party:80');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/social');
  });

  it('uses a restored validated intent when login has no safe return destination', async () => {
    mockReadPendingOnboardingIntent.mockResolvedValue('internships');
    mockLoginRequest.mockResolvedValue({ token: 'token', partyId: 81, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'demo-user');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'demo-pass');
    fireEvent.press(screen.getByTestId('loginButton'));

    await waitFor(() => expect(mockUpdateOnboardingIntent).toHaveBeenCalledWith('internships'));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/access-requests/new',
      params: { feature: 'internships', action: 'view' },
    });
    await waitFor(() => expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      'tdf-onboarding-intent:party:81',
    ));
  });

  it('does not clear an intent after a different authenticated session takes ownership', async () => {
    let resolveUpdate: ((value: { eligible: boolean }) => void) | undefined;
    mockSearchParams = { intent: 'follow_artists' };
    mockLoginRequest.mockResolvedValue({
      token: 'first-token',
      partyId: 83,
      roles: ['Customer'],
      modules: [],
    });
    mockUpdateOnboardingIntent.mockReturnValueOnce(new Promise((resolve) => {
      resolveUpdate = resolve;
    }));

    render(<AuthScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'demo-user');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'demo-pass');
    fireEvent.press(screen.getByTestId('loginButton'));

    await waitFor(() => expect(mockUpdateOnboardingIntent).toHaveBeenCalledWith('follow_artists'));
    mockIsCurrentAuthToken.mockReturnValue(false);
    resolveUpdate?.({ eligible: false });

    await waitFor(() => expect(mockIsCurrentAuthToken).toHaveBeenCalledWith('first-token'));
    expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith('tdf-onboarding-intent:party:83');
  });

  it('exposes internships as a signup intent without treating it as a role', async () => {
    mockSignupRequest.mockResolvedValue({ token: 'token', partyId: 82, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.press(screen.getByText('Crear cuenta'));
    fireEvent.changeText(screen.getByPlaceholderText('Tu nombre'), 'Sofía');
    fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'sofia@example.com');
    fireEvent.changeText(screen.getByPlaceholderText(/Mínimo 8 caracteres/i), 'password-seguro');
    fireEvent.press(screen.getByRole('radio', { name: 'Buscar prácticas' }));
    fireEvent.press(screen.getByTestId('termsCheckbox'));
    fireEvent.press(screen.getByTestId('signupButton'));

    await waitFor(() => expect(mockSignupRequest).toHaveBeenCalled());
    expect(mockSignupRequest.mock.calls[0]?.[0]).toHaveProperty('onboardingIntent', 'internships');
    expect(mockSignupRequest.mock.calls[0]?.[0]).not.toHaveProperty('roles');
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/access-requests/new',
      params: { feature: 'internships', action: 'view' },
    });
  });

  it('retains pending intent when authentication fails', async () => {
    mockLoginRequest.mockRejectedValueOnce(new Error('invalid'));
    render(<AuthScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'demo-user');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'demo-pass');
    fireEvent.press(screen.getByTestId('loginButton'));

    await waitFor(() => expect(screen.getByText('invalid')).toBeTruthy());
    expect(mockClearPendingOnboardingIntent).not.toHaveBeenCalled();
  });

  it('hides Google login when this build has no Google client id configured', async () => {
    mockAuthConfig.GOOGLE_WEB_CLIENT_ID = undefined;

    render(<AuthScreen />);

    await waitFor(() => expect(mockLoadNativeGoogleSignin).toHaveBeenCalled());
    // Sign in with Apple is still offered on iOS, so the social divider stays.
    expect(await screen.findByTestId('appleSignInButton')).toBeTruthy();
    expect(screen.queryByText(/Continuar con Google/i)).toBeNull();
    expect(screen.getByText(/^o$/i)).toBeTruthy();
    screen.unmount();

    mockAppleIsAvailable.mockResolvedValue(false);
    render(<AuthScreen />);

    await waitFor(() => expect(mockAppleIsAvailable).toHaveBeenCalled());
    await waitFor(() => expect(mockLoadNativeGoogleSignin).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('appleSignInButton')).toBeNull();
    expect(screen.queryByText(/Continuar con Google/i)).toBeNull();
    expect(screen.queryByText(/^o$/i)).toBeNull();
  });

  it('keeps login actions hidden while a saved session is still hydrating', async () => {
    jest.mocked(require('../src/providers/AuthProvider').useAuth).mockReturnValue({
      token: null,
      partyId: null,
      loading: true,
      setToken: mockSetToken,
      clearToken: mockClearToken,
    });

    render(<AuthScreen />);

    await waitFor(() => expect(mockLoadNativeGoogleSignin).toHaveBeenCalled());
    expect(screen.getByText(/Cargando sesión guardada…/i)).toBeTruthy();
    expect(screen.queryByTestId('loginButton')).toBeNull();
    expect(screen.queryByText(/Continuar con Google/i)).toBeNull();
  });

  it('clears the current session', async () => {
    jest.mocked(require('../src/providers/AuthProvider').useAuth).mockReturnValue({
      token: 'Bearer existing-token',
      partyId: '99',
      loading: false,
      setToken: mockSetToken,
      clearToken: mockClearToken,
    });

    render(<AuthScreen />);

    await waitFor(() => expect(mockLoadNativeGoogleSignin).toHaveBeenCalled());
    const clearSessionButton = screen.getByText(/Cerrar sesión/i).parent;
    if (!clearSessionButton) throw new Error('Clear session button not found');
    fireEvent.press(clearSessionButton);

    await waitFor(() => expect(mockGoogleSignOut).toHaveBeenCalled());
    await waitFor(() => expect(mockClearToken).toHaveBeenCalled());
    expect(screen.getByText(/Sesión cerrada/i)).toBeTruthy();
    expect(screen.queryByTestId('loginButton')).toBeNull();
    expect(screen.queryByText(/Continuar con Google/i)).toBeNull();
  });

  describe('Sign in with Apple', () => {
    beforeEach(() => {
      // Earlier cases leave useAuth returning an active or hydrating session.
      jest.mocked(require('../src/providers/AuthProvider').useAuth).mockReturnValue({
        token: null,
        partyId: null,
        loading: false,
        setToken: mockSetToken,
        clearToken: mockClearToken,
      });
    });

    const appleCredential = {
      user: 'apple-user',
      state: null,
      fullName: { namePrefix: null, givenName: 'Diego', middleName: null, familyName: 'Saá', nameSuffix: null, nickname: null },
      email: 'relay@privaterelay.appleid.com',
      realUserStatus: 2,
      identityToken: 'apple-identity-token',
      authorizationCode: 'apple-auth-code',
    };

    it('renders the Apple button only on iOS devices that support it', async () => {
      render(<AuthScreen />);
      expect(await screen.findByTestId('appleSignInButton')).toBeTruthy();
      expect(screen.getByText('Sign in with Apple')).toBeTruthy();
      expect(screen.getByText(/Continuar con Google/i)).toBeTruthy();
      screen.unmount();

      mockAppleIsAvailable.mockResolvedValue(false);
      render(<AuthScreen />);
      await waitFor(() => expect(mockAppleIsAvailable).toHaveBeenCalled());
      await screen.findByText(/Continuar con Google/i);
      expect(screen.queryByTestId('appleSignInButton')).toBeNull();
      screen.unmount();

      mockAppleIsAvailable.mockResolvedValue(true);
      mockLoadNativeAppleAuthentication.mockClear();
      const originalPlatform = Platform.OS;
      Platform.OS = 'android';
      try {
        render(<AuthScreen />);
        await screen.findByText(/Continuar con Google/i);
        expect(screen.queryByTestId('appleSignInButton')).toBeNull();
        expect(mockLoadNativeAppleAuthentication).not.toHaveBeenCalled();
      } finally {
        Platform.OS = originalPlatform;
      }
    });

    it('hides Apple on signup until the terms are accepted, then offers the sign-up variant', async () => {
      mockSearchParams = { mode: 'signup' };
      render(<AuthScreen />);
      await waitFor(() => expect(mockAppleIsAvailable).toHaveBeenCalled());
      expect(screen.queryByTestId('appleSignInButton')).toBeNull();
      fireEvent.press(screen.getByTestId('termsCheckbox'));
      expect(await screen.findByText('Sign up with Apple')).toBeTruthy();
    });

    it('signs in with a hashed nonce for Apple and the raw nonce plus name for the backend', async () => {
      mockAppleSignIn.mockResolvedValue(appleCredential);
      mockAppleLoginRequest.mockResolvedValue({
        token: 'Bearer apple-mobile-token',
        partyId: 91,
        roles: [],
        modules: [],
        accountCreated: false,
      });

      render(<AuthScreen />);
      fireEvent.press(await screen.findByTestId('appleSignInButton'));

      await waitFor(() => expect(mockAppleSignIn).toHaveBeenCalledWith({
        requestedScopes: [0, 1],
        nonce: APPLE_HASHED_NONCE,
      }));
      await waitFor(() => expect(mockAppleLoginRequest).toHaveBeenCalledWith({
        identityToken: 'apple-identity-token',
        nonce: APPLE_RAW_NONCE,
        fullName: { givenName: 'Diego', familyName: 'Saá' },
      }));
      await waitFor(() => expect(mockSetToken).toHaveBeenCalledWith('Bearer apple-mobile-token', 91, { roles: [], modules: [] }));
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/directory'));
      expect(mockClearPendingOnboardingIntent).not.toHaveBeenCalled();
      expect(screen.getByText('Sesión con Apple iniciada.')).toBeTruthy();
    });

    it('creates the account with explicit consent and intent when Apple is used from signup', async () => {
      mockAppleSignIn.mockResolvedValue({ ...appleCredential, fullName: null });
      mockAppleLoginRequest.mockResolvedValue({
        token: 'Bearer apple-created-token',
        partyId: 92,
        roles: ['Customer'],
        modules: [],
        accountCreated: true,
      });
      mockSearchParams = { mode: 'signup', intent: 'follow_artists' };

      render(<AuthScreen />);
      fireEvent.press(await screen.findByTestId('termsCheckbox'));
      fireEvent.press(await screen.findByText('Sign up with Apple'));

      await waitFor(() => expect(mockAppleLoginRequest).toHaveBeenCalledWith({
        identityToken: 'apple-identity-token',
        nonce: APPLE_RAW_NONCE,
        createNewAccount: true,
        marketingOptIn: false,
        termsAccepted: true,
        termsVersion: 'tdf-account-terms-v1',
        onboardingIntent: 'follow_artists',
      }));
      await waitFor(() => expect(mockClearPendingOnboardingIntent).toHaveBeenCalledTimes(1));
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/social');
    });

    it('stays silent when the user dismisses the Apple sheet', async () => {
      mockAppleSignIn.mockRejectedValue(Object.assign(new Error('The user canceled the authorization attempt'), {
        code: 'ERR_REQUEST_CANCELED',
      }));

      render(<AuthScreen />);
      fireEvent.press(await screen.findByTestId('appleSignInButton'));

      await waitFor(() => expect(mockAppleSignIn).toHaveBeenCalled());
      expect(await screen.findByTestId('appleSignInButton')).toBeTruthy();
      expect(mockAppleLoginRequest).not.toHaveBeenCalled();
      expect(mockSetToken).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByText(/Apple/i, { exact: false })).toBeTruthy();
      expect(screen.queryByText('No pudimos iniciar sesión con Apple.')).toBeNull();
    });

    it('reports other Apple failures in the current language', async () => {
      mockLocale = 'en';
      mockAppleSignIn.mockRejectedValue(Object.assign(new Error('boom'), { code: 'ERR_REQUEST_FAILED' }));

      render(<AuthScreen />);
      fireEvent.press(await screen.findByTestId('appleSignInButton'));

      expect((await screen.findByRole('alert')).props.children).toBe('boom');
      expect(mockAppleLoginRequest).not.toHaveBeenCalled();
    });

    it('connects Apple only after an explicit existing-account password confirmation', async () => {
      mockAppleSignIn.mockResolvedValue({ ...appleCredential, fullName: null });
      mockAppleLoginRequest
        .mockRejectedValueOnce(new Error('Accept the terms and privacy policy through the signup flow before creating an Apple account'))
        .mockResolvedValueOnce({ token: 'apple-linked-token', partyId: 93, roles: [], modules: [], accountCreated: false });

      render(<AuthScreen />);
      fireEvent.press(await screen.findByTestId('appleSignInButton'));
      await screen.findByText('Conectar Apple a mi cuenta TDF');
      expect(mockSetToken).not.toHaveBeenCalled();
      expect(mockAppleLoginRequest).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByTestId('appleSignInButton'));
      expect((await screen.findByRole('alert')).props.children).toMatch(/Para conectar Apple/);
      expect(mockAppleLoginRequest).toHaveBeenCalledTimes(1);

      fireEvent.changeText(screen.getByPlaceholderText('usuario o correo'), 'existing-user');
      fireEvent.changeText(screen.getByPlaceholderText('Tu contraseña'), 'existing-password');
      fireEvent.press(screen.getByTestId('appleSignInButton'));
      await waitFor(() => expect(mockAppleLoginRequest).toHaveBeenLastCalledWith({
        identityToken: 'apple-identity-token',
        nonce: APPLE_RAW_NONCE,
        linkAccount: { username: 'existing-user', password: 'existing-password' },
      }));
      await waitFor(() => expect(mockSetToken).toHaveBeenCalledWith('apple-linked-token', 93, { roles: [], modules: [] }));
    });
  });
});
