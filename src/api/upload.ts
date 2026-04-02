import { Platform } from 'react-native';
import { getAuthToken } from './client';
import { UPLOAD_BASE } from '../lib/api';

const UPLOAD_URL = UPLOAD_BASE;

export type UploadResponse = {
  publicUrl?: string;
  webViewLink?: string;
  webContentLink?: string;
  fileId?: string;
};

export async function uploadMedia({
  uri,
  mimeType,
  fileName,
  uploadLabel = 'archivo',
}: {
  uri: string;
  mimeType?: string;
  fileName?: string;
  uploadLabel?: string;
}): Promise<string> {
  if (!UPLOAD_URL) {
    throw new Error(`No se ha configurado EXPO_PUBLIC_UPLOAD_URL para subir ${uploadLabel}s.`);
  }
  const token = getAuthToken();
  const data = new FormData();

  const name = fileName ?? uri.split('/').pop() ?? 'upload.bin';
  const type = mimeType || 'application/octet-stream';
  const uploadUri = Platform.OS === 'ios' ? uri.replace('file://', '') : uri;

  data.append('file', {
    uri: uploadUri,
    name,
    type
  } as unknown as Blob);

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: token } : {})
    },
    body: data
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `No se pudo subir el ${uploadLabel}`);
  }

  const json = (await res.json().catch(() => ({}))) as UploadResponse;
  const url = json.publicUrl || json.webViewLink || json.webContentLink;
  if (!url) throw new Error('Subida exitosa pero no se devolvió URL pública');
  return url;
}

export async function uploadImage(input: {
  uri: string;
  mimeType?: string;
  fileName?: string;
}): Promise<string> {
  return uploadMedia({ ...input, uploadLabel: 'imagen' });
}
