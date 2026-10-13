import axios from 'axios';

import { http } from './client';
import type { components } from './generated/types';

type LoginRequestDTO = components['schemas']['LoginRequest'];
type GoogleLoginRequestDTO = components['schemas']['GoogleLoginRequest'];
type SignupRequestDTO = components['schemas']['SignupRequest'];
export type LoginResponseDTO = components['schemas']['LoginResponse'];

/**
 * Hand-written against the `POST /login/apple` contract added by the parent repository
 * (tdf-app "Sign in with Apple" backend change). Replace with the generated schema once the
 * OpenAPI document that ships it is pinned here via `npm run generate:api`.
 */
export type AppleLoginRequestDTO = {
  /** `credential.identityToken` returned by expo-apple-authentication. */
  identityToken: string;
  /** The raw nonce whose SHA-256 hex digest was passed to Apple as `nonce`. */
  nonce?: string;
  /** Only present on the first authorization; Apple omits the name afterwards. */
  fullName?: { givenName?: string; familyName?: string };
  /** Must be explicitly true, with current terms acceptance, to create an account for an unbound Apple subject. */
  createNewAccount?: boolean;
  /** Explicitly connect the verified Apple identity using the existing TDF account credentials. */
  linkAccount?: LoginRequestDTO;
  marketingOptIn?: boolean;
  termsAccepted?: boolean;
  termsVersion?: string;
  onboardingIntent?: components['schemas']['OnboardingIntent'];
};

const readErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;

    if (typeof responseData === 'string' && responseData.trim()) {
      return responseData.trim();
    }

    if (
      typeof responseData === 'object' &&
      responseData !== null &&
      'message' in responseData &&
      typeof responseData.message === 'string' &&
      responseData.message.trim()
    ) {
      return responseData.message.trim();
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

export async function loginRequest(payload: LoginRequestDTO): Promise<LoginResponseDTO> {
  try {
    const response = await http.post<LoginResponseDTO>('/login', payload);
    return response.data;
  } catch (error) {
    throw new Error(readErrorMessage(error, 'Credenciales inválidas'));
  }
}

export async function googleLoginRequest(payload: GoogleLoginRequestDTO): Promise<LoginResponseDTO> {
  try {
    const response = await http.post<LoginResponseDTO>('/login/google', payload);
    return response.data;
  } catch (error) {
    throw new Error(readErrorMessage(error, 'No pudimos iniciar sesión con Google.'));
  }
}

export async function appleLoginRequest(payload: AppleLoginRequestDTO): Promise<LoginResponseDTO> {
  try {
    const response = await http.post<LoginResponseDTO>('/login/apple', payload);
    return response.data;
  } catch (error) {
    throw new Error(readErrorMessage(error, 'No pudimos iniciar sesión con Apple.'));
  }
}

export async function signupRequest(payload: SignupRequestDTO): Promise<LoginResponseDTO> {
  try {
    const response = await http.post<LoginResponseDTO>('/signup', payload);
    return response.data;
  } catch (error) {
    throw new Error(readErrorMessage(error, 'No pudimos crear tu cuenta. Revisa los datos e inténtalo de nuevo.'));
  }
}

export async function requestPasswordReset(email: string, locale?: string): Promise<void> {
  try {
    const query = locale ? `?locale=${locale.toLowerCase().startsWith('es') ? 'es' : 'en'}` : '';
    await http.post(`/v1/password-reset${query}`, { email });
  } catch (error) {
    throw new Error(readErrorMessage(error, 'No pudimos iniciar el reset. Verifica el correo.'));
  }
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<LoginResponseDTO> {
  try {
    const response = await http.post<LoginResponseDTO>('/v1/password-reset/confirm', { token, newPassword });
    return response.data;
  } catch (error) {
    throw new Error(readErrorMessage(error, 'No pudimos restablecer la contraseña.'));
  }
}
