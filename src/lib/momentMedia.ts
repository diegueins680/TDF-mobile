import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type { EventMomentMedia } from '../types';

export const MAX_MOMENT_MEDIA_SELECTION = 6;
export const MAX_MOMENT_IMAGE_EDGE = 1600;

export type DraftMomentMedia = EventMomentMedia & {
  fileName?: string | null;
};

const replaceFileExtension = (fileName: string | null | undefined, extension: string): string => {
  const normalized = fileName?.trim() || 'momento';
  const stem = normalized.replace(/\.[^./\\]+$/, '') || 'momento';
  return `${stem}.${extension}`;
};

export const getMomentImageResizeAction = (
  width?: number | null,
  height?: number | null,
): { resize: { width?: number; height?: number } } | null => {
  if (!width || !height || width <= 0 || height <= 0) return null;
  if (Math.max(width, height) <= MAX_MOMENT_IMAGE_EDGE) return null;

  return width >= height
    ? { resize: { width: MAX_MOMENT_IMAGE_EDGE } }
    : { resize: { height: MAX_MOMENT_IMAGE_EDGE } };
};

export async function prepareMomentMediaForUpload(
  media: DraftMomentMedia,
): Promise<DraftMomentMedia> {
  if (media.kind !== 'image') return media;

  const resizeAction = getMomentImageResizeAction(media.width, media.height);

  try {
    const result = await manipulateAsync(
      media.uri,
      resizeAction ? [resizeAction] : [],
      {
        compress: 0.78,
        format: SaveFormat.JPEG,
      },
    );

    return {
      ...media,
      uri: result.uri,
      mimeType: 'image/jpeg',
      width: result.width,
      height: result.height,
      fileName: replaceFileExtension(media.fileName, 'jpg'),
    };
  } catch {
    // Unsupported formats should still be uploadable in their original form.
    return media;
  }
}
