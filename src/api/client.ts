import axios from 'axios';
import { API_BASE } from '../lib/api';

let currentToken: string | undefined =
  process.env.EXPO_PUBLIC_API_TOKEN?.trim() || undefined;

export const http = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    ...(currentToken ? { Authorization: currentToken } : {})
  }
});

export function setAuthToken(token: string | null | undefined) {
  currentToken = token?.trim() || undefined;
  if (currentToken) {
    http.defaults.headers.common.Authorization = currentToken;
  } else {
    delete http.defaults.headers.common.Authorization;
  }
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

export async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await http.patch<T>(path, body);
  return res.data;
}
