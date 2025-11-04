import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { api } from '../lib/api';

type RequestConfig = Omit<AxiosRequestConfig, 'url' | 'method'>;

async function extract<T>(promise: Promise<AxiosResponse<T>>): Promise<T> {
  const response = await promise;
  return response.data;
}

export function get<T>(path: string, config?: RequestConfig): Promise<T> {
  return extract(api.get<T>(path, config));
}

export function post<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T> {
  return extract(api.post<T>(path, body, config));
}

export function put<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T> {
  return extract(api.put<T>(path, body, config));
}

export function patch<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T> {
  return extract(api.patch<T>(path, body, config));
}
