import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type LegacyConstants = {
  manifest?: { hostUri?: string };
  manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
};

type ExpoExtra = {
  apiBase?: string | null;
  uploadUrl?: string | null;
  appEnvironment?: string | null;
};

const normalizeEnv = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const deriveDevHost = () => {
  const legacy = Constants as LegacyConstants;
  const hostUri =
    Constants.expoConfig?.hostUri ||
    // Fallback for classic manifest
    legacy.manifest?.hostUri ||
    legacy.manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return host;
  }
  return Platform.select({ android: '10.0.2.2', ios: 'localhost', default: 'localhost' }) ?? 'localhost';
};

const expoExtra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
const configuredApiBase = normalizeEnv(process.env.EXPO_PUBLIC_API_BASE) ?? normalizeEnv(expoExtra.apiBase);
const configuredUploadBase =
  normalizeEnv(process.env.EXPO_PUBLIC_UPLOAD_URL) ?? normalizeEnv(expoExtra.uploadUrl);
const isDevelopmentBuild = process.env.NODE_ENV !== 'production';
const appEnvironment = normalizeEnv(expoExtra.appEnvironment) ?? (isDevelopmentBuild ? 'development' : 'production');

export const API_BASE = (
  configuredApiBase ?? (appEnvironment === 'development' ? `http://${deriveDevHost()}:8080` : '')
).replace(/\/+$/, '');

if (!API_BASE && appEnvironment !== 'development') {
  console.error('EXPO_PUBLIC_API_BASE is missing for a non-development build.');
}

const API_TOKEN = normalizeEnv(process.env.EXPO_PUBLIC_API_TOKEN);
export const UPLOAD_BASE = configuredUploadBase;

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
