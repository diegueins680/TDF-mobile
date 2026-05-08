import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockSetToken = jest.fn();
const mockClearToken = jest.fn();
const mockLoginRequest = jest.fn();
const mockGoogleLoginRequest = jest.fn();
const mockGoogleHasPlayServices = jest.fn();
const mockGoogleSignIn = jest.fn();
const mockGoogleSignOut = jest.fn();
const mockReplace = jest.fn();
let mockAuthConfig = {
  GOOGLE_WEB_CLIENT_ID: 'web-client-id.apps.googleusercontent.com',
  GOOGLE_IOS_CLIENT_ID: 'ios-client-id.apps.googleusercontent.com',
  GOOGLE_IOS_URL_SCHEME: 'com.googleusercontent.apps.123456',
};

jest.mock('../src/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({
    token: null,
    partyId: null,
    loading: false,
    setToken: mockSetToken,
    clearToken: mockClearToken,
  })),
}));

jest.mock('../src/api/auth', () => ({
  loginRequest: (...args: unknown[]) => mockLoginRequest(...args),
  googleLoginRequest: (...args: unknown[]) => mockGoogleLoginRequest(...args),
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

jest.mock('@react-native-google-signin/google-signin', () => ({
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
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const AuthScreen = require('../app/auth').default;

describe('Auth screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReplace.mockReset();
    mockAuthConfig.GOOGLE_WEB_CLIENT_ID = 'web-client-id.apps.googleusercontent.com';
    mockAuthConfig.GOOGLE_IOS_CLIENT_ID = 'ios-client-id.apps.googleusercontent.com';
    mockAuthConfig.GOOGLE_IOS_URL_SCHEME = 'com.googleusercontent.apps.123456';
    mockGoogleHasPlayServices.mockResolvedValue(true);
    mockGoogleSignOut.mockResolvedValue(null);
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
    fireEvent.changeText(screen.getByPlaceholderText(/tu password/i), 'demo-pass');
    expect(screen.getByDisplayValue('demo-user')).toBeTruthy();
    expect(screen.getByDisplayValue('demo-pass')).toBeTruthy();

    const passwordButton = screen.getByText(/Entrar con password/i).parent;
    if (!passwordButton) throw new Error('Password login button not found');
    fireEvent.press(passwordButton);

    await waitFor(() => {
      expect(mockLoginRequest).toHaveBeenCalledWith({
        username: 'demo-user',
        password: 'demo-pass',
      });
      expect(mockSetToken).toHaveBeenCalledWith('Bearer mobile-token', 42);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/parties');
    });
    expect(await screen.findByText(/Party activa: 42/i)).toBeTruthy();
  }, 10_000);

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

    const googleButton = screen.getByText(/Continuar con Google/i).parent;
    if (!googleButton) throw new Error('Google button not found');
    fireEvent.press(googleButton);

    await waitFor(() => expect(mockGoogleSignIn).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockGoogleLoginRequest).toHaveBeenCalledWith({ idToken: 'google-id-token' })
    );
    await waitFor(() => expect(mockSetToken).toHaveBeenCalledWith('Bearer google-mobile-token', 77));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/parties'));
    expect(screen.getByText(/Party activa: 77/i)).toBeTruthy();
  });

  it('hides Google login when this build has no Google client id configured', () => {
    mockAuthConfig.GOOGLE_WEB_CLIENT_ID = undefined;

    render(<AuthScreen />);

    expect(screen.queryByText(/Continuar con Google/i)).toBeNull();
    expect(screen.queryByText(/^o$/i)).toBeNull();
  });

  it('keeps login actions hidden while a saved session is still hydrating', () => {
    jest.mocked(require('../src/providers/AuthProvider').useAuth).mockReturnValue({
      token: null,
      partyId: null,
      loading: true,
      setToken: mockSetToken,
      clearToken: mockClearToken,
    });

    render(<AuthScreen />);

    expect(screen.getByText(/Cargando sesión guardada…/i)).toBeTruthy();
    expect(screen.queryByText(/Entrar con password/i)).toBeNull();
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

    const clearSessionButton = screen.getByText(/Cerrar sesión/i).parent;
    if (!clearSessionButton) throw new Error('Clear session button not found');
    fireEvent.press(clearSessionButton);

    await waitFor(() => expect(mockGoogleSignOut).toHaveBeenCalled());
    await waitFor(() => expect(mockClearToken).toHaveBeenCalled());
    expect(screen.getByText(/Sesión cerrada/i)).toBeTruthy();
    expect(screen.queryByText(/Entrar con password/i)).toBeNull();
    expect(screen.queryByText(/Continuar con Google/i)).toBeNull();
  });
});
