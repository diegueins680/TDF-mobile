import axios from 'axios';
import { API_BASE } from '~/lib/api';

export const http = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

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
