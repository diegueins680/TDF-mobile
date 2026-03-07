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
  headers: { 'Content-Type': 'application/json' }
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

export async function get<T>(path: string): Promise<T> {
  const res = await http.get<T>(path);
  return res.data;
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await http.post<T>(path, body);
  return res.data;
}

export async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await http.put<T>(path, body);
  return res.data;
}

export async function del<T>(path: string): Promise<T> {
  const res = await http.delete<T>(path);
  return res.data;
}

export async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await http.patch<T>(path, body);
  return res.data;
}
