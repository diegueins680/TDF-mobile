import { Platform } from 'react-native';
import { getAuthToken } from './client';

const UPLOAD_URL = process.env.EXPO_PUBLIC_UPLOAD_URL;

export type UploadResponse = {
  publicUrl?: string;
  webViewLink?: string;
  webContentLink?: string;
  fileId?: string;
};

export async function uploadImage({
  uri,
  mimeType,
  fileName
}: {
  uri: string;
  mimeType?: string;
  fileName?: string;
}): Promise<string> {
  if (!UPLOAD_URL) {
    throw new Error('No se ha configurado EXPO_PUBLIC_UPLOAD_URL para subir imágenes.');
  }
  const token = getAuthToken();
  const data = new FormData();

  const name = fileName ?? uri.split('/').pop() ?? 'photo.jpg';
  const type = mimeType || 'image/jpeg';
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
    throw new Error(text || 'No se pudo subir la imagen');
  }

  const json = (await res.json().catch(() => ({}))) as UploadResponse;
  const url = json.publicUrl || json.webViewLink || json.webContentLink;
  if (!url) throw new Error('Subida exitosa pero no se devolvió URL pública');
  return url;
}
