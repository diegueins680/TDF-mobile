import type { DocumentPickerAsset } from 'expo-document-picker';

import type { DraftMomentMedia } from './momentMedia';

// Match the existing event media endpoint. The server also checks real size,
// MIME/extension, file signatures, event visibility and the current session.
export const MAX_MOMENT_AUDIO_BYTES = 25 * 1024 * 1024;
const formats: Record<string, { mime: string; aliases: string[] }> = {
  mp3: { mime: 'audio/mpeg', aliases: ['audio/mpeg', 'audio/mp3'] },
  m4a: { mime: 'audio/mp4', aliases: ['audio/mp4', 'audio/x-m4a'] },
  wav: { mime: 'audio/wav', aliases: ['audio/wav', 'audio/x-wav', 'audio/wave'] },
  ogg: { mime: 'audio/ogg', aliases: ['audio/ogg', 'application/ogg'] },
  flac: { mime: 'audio/flac', aliases: ['audio/flac', 'audio/x-flac'] },
};

export class MomentAudioSelectionError extends Error {
  constructor(readonly code: 'format' | 'size' | 'file') {
    super(code);
  }
}

const hasControlCharacters = (value: string): boolean =>
  Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);

export function momentAudioFromAsset(asset: DocumentPickerAsset): DraftMomentMedia {
  const name = asset.name?.trim();
  const uri = asset.uri?.trim();
  if (!name || hasControlCharacters(name) || /[/\\]/.test(name)
    || !uri || hasControlCharacters(uri) || !/^(file:\/\/\/|content:\/\/).+$/i.test(uri)) {
    throw new MomentAudioSelectionError('file');
  }
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const format = Object.prototype.hasOwnProperty.call(formats, extension) ? formats[extension] : undefined;
  const mime = asset.mimeType?.trim().toLowerCase();
  // Some document providers omit MIME or return octet-stream. Use a supported
  // extension in that case; explicit incompatible MIME is never relabelled.
  if (!format || (mime && mime !== 'application/octet-stream' && !format.aliases.includes(mime))) {
    throw new MomentAudioSelectionError('format');
  }
  if (asset.size !== undefined && (!Number.isSafeInteger(asset.size)
    || asset.size <= 0 || asset.size > MAX_MOMENT_AUDIO_BYTES)) {
    throw new MomentAudioSelectionError('size');
  }
  return { kind: 'audio', uri, mimeType: format.mime, fileName: name };
}

export async function selectMomentAudio(): Promise<DraftMomentMedia[]> {
  // Load only on explicit user action. Older installed native binaries can
  // display the event even before this new native module has been shipped.
  // Keep this require inside the action, using Metro's standard module loader.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getDocumentAsync } = require('expo-document-picker') as typeof import('expo-document-picker');
  const result = await getDocumentAsync({ type: ['audio/*', 'application/ogg'], multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return [];
  if (!Array.isArray(result.assets) || result.assets.length !== 1) throw new MomentAudioSelectionError('file');
  return [momentAudioFromAsset(result.assets[0])];
}
