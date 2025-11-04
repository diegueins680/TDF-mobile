import axios from 'axios';

export const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:8080').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

export async function fetchHealth(): Promise<{ status: string; version?: string }> {
  const r = await api.get('/health'); // Makefile mentions health check
  return r.data;
}