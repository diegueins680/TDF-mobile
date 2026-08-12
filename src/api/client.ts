import axios from 'axios';
import { API_BASE } from '../lib/api';

const BEARER_PREFIX = /^bearer\b/i;

export const normalizeAuthToken = (token?: string | null) => {
  const trimmed = token?.trim();
  if (!trimmed) return undefined;

  if (BEARER_PREFIX.test(trimmed)) {
    const credentials = trimmed.replace(BEARER_PREFIX, '').trim();
    return credentials ? `Bearer ${credentials}` : undefined;
  }

  return `Bearer ${trimmed}`;
};

let currentToken: string | undefined = normalizeAuthToken(process.env.EXPO_PUBLIC_API_TOKEN);

export const http = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

const applyAuthHeader = (token?: string) => {
  if (token) {
    http.defaults.headers.common.Authorization = token;
  } else {
    delete http.defaults.headers.common.Authorization;
  }
};

applyAuthHeader(currentToken);

export function setAuthToken(token: string | null | undefined) {
  currentToken = normalizeAuthToken(token);
  applyAuthHeader(currentToken);
}

export function getAuthToken(): string | undefined {
  return currentToken;
}

const readResponseMessage = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return null;
};

const withApiErrorMessage = (error: Error, message: string): Error => {
  error.message = message;
  return error;
};

export function normalizeApiError(error: unknown): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error('Ocurrió un error inesperado.');
  }

  if (error.code === 'ECONNABORTED') {
    return withApiErrorMessage(
      error,
      'La solicitud tardó demasiado. Verifica tu conexión e inténtalo de nuevo.',
    );
  }

  if (!error.response) {
    return withApiErrorMessage(
      error,
      'No pudimos conectar. Comprueba tu internet e inténtalo otra vez.',
    );
  }

  const status = error.response.status;
  const serverMessage = readResponseMessage(error.response.data);
  const normalized = serverMessage?.toLowerCase() ?? '';

  if (status === 401) {
    return withApiErrorMessage(error, 'Tu sesión terminó. Vuelve a iniciar sesión.');
  }
  if (status === 403 && normalized.includes('paid tickets')) {
    return withApiErrorMessage(
      error,
      'Las entradas pagadas deben comprarse desde el checkout seguro.',
    );
  }
  if (
    status === 409
    && (normalized === 'not enough tickets available' || normalized === 'event capacity reached')
  ) {
    return withApiErrorMessage(
      error,
      'Estas entradas acaban de agotarse o ya no hay suficientes. Actualiza y elige otra cantidad.',
    );
  }
  if (normalized.includes('ticket sales are closed')) {
    return withApiErrorMessage(error, 'La venta de esta entrada ya no está disponible.');
  }
  if (normalized.includes('promo code')) {
    return withApiErrorMessage(error, 'El código promocional no es válido para esta compra.');
  }
  if (status >= 500) {
    return withApiErrorMessage(
      error,
      'El servicio está tardando más de lo normal. Inténtalo nuevamente en un momento.',
    );
  }
  return withApiErrorMessage(error, serverMessage ?? 'No pudimos completar la solicitud.');
}

const requestData = async <T>(request: Promise<{ data: T }>): Promise<T> => {
  try {
    const response = await request;
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
};

export async function get<T>(path: string): Promise<T> {
  return requestData(http.get<T>(path));
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  return requestData(http.post<T>(path, body));
}

export async function put<T>(path: string, body: unknown): Promise<T> {
  return requestData(http.put<T>(path, body));
}

export async function del<T>(path: string): Promise<T> {
  return requestData(http.delete<T>(path));
}

export async function patch<T>(path: string, body: unknown): Promise<T> {
  return requestData(http.patch<T>(path, body));
}
