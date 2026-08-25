import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockSetToken = jest.fn();
const mockClearToken = jest.fn();
const mockLoginRequest = jest.fn();
const mockGoogleLoginRequest = jest.fn();
const mockSignupRequest = jest.fn();
const mockGoogleHasPlayServices = jest.fn();
const mockGoogleSignIn = jest.fn();
const mockGoogleSignOut = jest.fn();
const mockLoadNativeGoogleSignin = jest.fn();
const mockReplace = jest.fn();
const mockMarkSignupCompleted = jest.fn();
const mockAttachPendingIntentToParty = jest.fn();
const mockPersistOnboardingIntent = jest.fn();
let mockAuthConfig = {
  GOOGLE_WEB_CLIENT_ID: 'web-client-id.apps.googleusercontent.com',
  GOOGLE_IOS_CLIENT_ID: 'ios-client-id.apps.googleusercontent.com',
  GOOGLE_IOS_URL_SCHEME: 'com.googleusercontent.apps.123456',
};
let mockSearchParams: Record<string, string> = {};
let mockLocale = 'es';

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
  loginRequest: (...args: unknown[]) => mockLoginRequest(...args),
  googleLoginRequest: (...args: unknown[]) => mockGoogleLoginRequest(...args),
  signupRequest: (...args: unknown[]) => mockSignupRequest(...args),
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

jest.mock('../src/lib/firstRunFlags', () => ({
  markSignupCompleted: (...args: unknown[]) => mockMarkSignupCompleted(...args),
}));

jest.mock('../src/lib/onboardingIntent', () => {
  const actual = jest.requireActual('../src/lib/onboardingIntent');
  return {
    ...actual,
    attachPendingIntentToParty: (...args: unknown[]) => mockAttachPendingIntentToParty(...args),
    persistOnboardingIntent: (...args: unknown[]) => mockPersistOnboardingIntent(...args),
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockSearchParams,
}));

const AuthScreen = require('../app/auth').default;

describe('Auth screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = {};
    mockLocale = 'es';
    mockReplace.mockReset();
    mockAuthConfig.GOOGLE_WEB_CLIENT_ID = 'web-client-id.apps.googleusercontent.com';
    mockAuthConfig.GOOGLE_IOS_CLIENT_ID = 'ios-client-id.apps.googleusercontent.com';
    mockAuthConfig.GOOGLE_IOS_URL_SCHEME = 'com.googleusercontent.apps.123456';
    mockGoogleHasPlayServices.mockResolvedValue(true);
    mockGoogleSignOut.mockResolvedValue(null);
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
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/events');
    });
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
    mockSearchParams = { returnTo: '/createArtistProfile' };
    mockLoginRequest.mockResolvedValue({ token: 'token', partyId: 5, roles: ['Customer'], modules: [] });
    render(<AuthScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(/usuario o correo/i), 'customer');
    fireEvent.changeText(screen.getByPlaceholderText(/tu contraseña/i), 'password');
    fireEvent.press(screen.getByTestId('loginButton'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/events'));
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

  it('localizes optional field labels in English signup mode', async () => {
    mockLocale = 'en';
    mockSearchParams = { mode: 'signup' };
    render(<AuthScreen />);

    expect(screen.getByText('Last name (optional)')).toBeTruthy();
    expect(screen.queryByText(/opcional/i)).toBeNull();
    await waitFor(() => expect(mockLoadNativeGoogleSignin).toHaveBeenCalled());
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
    }));
    expect(mockMarkSignupCompleted).toHaveBeenCalledWith('88');
    expect(mockAttachPendingIntentToParty).toHaveBeenCalledWith('88', 'events');
    expect(mockSetToken).toHaveBeenCalledWith('Bearer new-fan-token', 88, { roles: ['Fan'], modules: [] });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/events');
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
    expect(mockAttachPendingIntentToParty).toHaveBeenCalledWith('91', 'artist_profile');
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/access-requests/new',
      params: { feature: 'artist.onboarding', action: 'create' },
    });
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
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/events'));
    expect(screen.getByText('Sesión con Google iniciada.')).toBeTruthy();
  });

  it('hides Google login when this build has no Google client id configured', async () => {
    mockAuthConfig.GOOGLE_WEB_CLIENT_ID = undefined;

    render(<AuthScreen />);

    await waitFor(() => expect(mockLoadNativeGoogleSignin).toHaveBeenCalled());
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
});
