import { Platform } from 'react-native';
import { assertAuthSession, captureAuthSession, getAuthToken } from './client';
import { API_BASE } from '../lib/api';

export type StorageDestination = 'tdf' | 'google_drive';
export const isDriveConnectionHandle = (value: unknown): value is string =>
  typeof value === 'string' && /^tdf-vault-v1_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);

export type UploadInput = {
  uri: string;
  mimeType?: string;
  fileName?: string;
  uploadLabel?: string;
  destination?: StorageDestination;
  visibility?: 'private' | 'public';
  idempotencyKey?: string;
  connectionHandle?: string;
};

// Callers must retain idempotencyKey for retry and ask for an explicit destination.
// Existing corporate uploads use the unchanged upload.ts adapter.
// New account storage remains unavailable until explicit activation and UI/consent qualification.
export async function uploadAccountMedia(input: UploadInput): Promise<string> {
  if (process.env.EXPO_PUBLIC_CONTENT_STORAGE_ENABLED !== 'true') throw new Error('El almacenamiento de cuenta todavía no está habilitado.');
  const { uri, destination, visibility = 'private', idempotencyKey, connectionHandle } = input;
  if (!destination || !['tdf', 'google_drive'].includes(destination)) {
    throw new Error('Selecciona dónde guardar el archivo antes de subirlo.');
  }
  if (!idempotencyKey || !/^[a-f0-9]{64}$/.test(idempotencyKey)) {
    throw new Error('La carga necesita una identidad estable para poder recuperarse.');
  }
  if (destination === 'google_drive' && !isDriveConnectionHandle(connectionHandle)) {
    throw new Error('Conecta tu Google Drive personal antes de subir el archivo.');
  }
  if (destination === 'tdf' && connectionHandle !== undefined) {
    throw new Error('La conexión personal no puede usarse para almacenamiento de TDF.');
  }
  const binding = captureAuthSession(getAuthToken());
  const data = new FormData();
  data.append('file', {
    uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
    name: input.fileName ?? uri.split('/').pop() ?? 'upload.bin',
    type: input.mimeType || 'application/octet-stream',
  } as unknown as Blob);
  data.append('destination', destination);
  data.append('authMode', destination === 'google_drive' ? 'user' : 'server');
  data.append('visibility', visibility);
  data.append('idempotencyKey', idempotencyKey);
  if (connectionHandle) data.append('accessToken', connectionHandle);
  const res = await fetch(`${API_BASE}/drive/upload`, {
    method: 'POST', headers: { Authorization: binding.authorization },
    body: data, signal: binding.signal,
  });
  assertAuthSession(binding);
  if (!res.ok) throw new Error(res.status === 503
    ? 'Las cargas de archivos todavía no están habilitadas o el servicio no está disponible.'
    : 'No se pudo confirmar la carga. Conserva el archivo y reintenta con la misma identidad.');
  const json = await res.json() as Record<string, unknown>;
  assertAuthSession(binding);
  const url = visibility === 'public' ? json.duPublicUrl : json.duWebContentLink ?? json.duWebViewLink;
  if (typeof url !== 'string' || !url) throw new Error('La carga no devolvió un enlace autorizado.');
  if (url.startsWith('/storage/files/')) return `${API_BASE}${url}`;
  if (!url.startsWith('https://')) throw new Error('Enlace de almacenamiento inválido.');
  return url;
}

export async function uploadAccountImage(input: UploadInput): Promise<string> {
  return uploadAccountMedia({ ...input, uploadLabel: 'imagen' });
}

export async function readPrivateStorageFile(fileId: string): Promise<ArrayBuffer> {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(fileId)) throw new Error('Archivo inválido');
  const binding = captureAuthSession(getAuthToken());
  const response = await fetch(`${API_BASE}/storage/files/${fileId}`, {
    headers: { Authorization: binding.authorization }, signal: binding.signal, cache: 'no-store',
  });
  assertAuthSession(binding);
  if (!response.ok) throw new Error('Adjunto no disponible para esta cuenta.');
  const bytes = await response.arrayBuffer();
  assertAuthSession(binding);
  return bytes;
}
