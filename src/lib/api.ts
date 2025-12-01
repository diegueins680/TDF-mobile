import axios from 'axios';

export const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:8080').replace(/\/+$/, '');
const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN?.trim();

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

if (API_TOKEN) {
  api.defaults.headers.common.Authorization = API_TOKEN.toLowerCase().startsWith('bearer ')
    ? API_TOKEN
    : `Bearer ${API_TOKEN}`;
}

export async function fetchHealth(): Promise<{ status: string; version?: string }> {
  const r = await api.get('/health'); // Makefile mentions health check
  return r.data;
}
