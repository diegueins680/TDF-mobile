import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type LegacyConstants = {
  manifest?: { hostUri?: string };
  manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
};

type ExpoExtra = {
  apiBase?: string;
  uploadUrl?: string;
};

const readConfigValue = (value?: string | null) => value?.trim() || undefined;

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

const expoExtra = Constants.expoConfig?.extra as ExpoExtra | undefined;

export const API_BASE =
  (readConfigValue(process.env.EXPO_PUBLIC_API_BASE) ||
    readConfigValue(expoExtra?.apiBase) ||
    `http://${deriveDevHost()}:8080`).replace(/\/+$/, '');
const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN?.trim();
export const UPLOAD_BASE = readConfigValue(process.env.EXPO_PUBLIC_UPLOAD_URL) || readConfigValue(expoExtra?.uploadUrl);

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
