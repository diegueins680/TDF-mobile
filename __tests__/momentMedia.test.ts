import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import {
  getMomentImageResizeAction,
  MAX_MOMENT_IMAGE_EDGE,
  prepareMomentMediaForUpload,
} from '../src/lib/momentMedia';

const mockManipulateAsync = jest.mocked(manipulateAsync);

describe('moment media preparation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('downsizes large landscape and portrait images without changing their aspect ratio', () => {
    expect(getMomentImageResizeAction(4000, 3000)).toEqual({
      resize: { width: MAX_MOMENT_IMAGE_EDGE },
    });
    expect(getMomentImageResizeAction(1200, 3000)).toEqual({
      resize: { height: MAX_MOMENT_IMAGE_EDGE },
    });
    expect(getMomentImageResizeAction(1200, 900)).toBeNull();
  });

  it('creates a compressed upload copy while keeping the instant local preview untouched', async () => {
    mockManipulateAsync.mockResolvedValue({
      uri: 'file:///cache/showcase.jpg',
      width: 1600,
      height: 1200,
    });
    const selected = {
      kind: 'image' as const,
      uri: 'file:///library/showcase.heic',
      mimeType: 'image/heic',
      width: 4032,
      height: 3024,
      fileName: 'showcase.heic',
    };

    await expect(prepareMomentMediaForUpload(selected)).resolves.toEqual({
      ...selected,
      uri: 'file:///cache/showcase.jpg',
      mimeType: 'image/jpeg',
      width: 1600,
      height: 1200,
      fileName: 'showcase.jpg',
    });
    expect(mockManipulateAsync).toHaveBeenCalledWith(
      selected.uri,
      [{ resize: { width: MAX_MOMENT_IMAGE_EDGE } }],
      { compress: 0.78, format: SaveFormat.JPEG },
    );
  });

  it('keeps the original file when optimization is unsupported', async () => {
    mockManipulateAsync.mockRejectedValue(new Error('Unsupported format'));
    const selected = {
      kind: 'image' as const,
      uri: 'file:///library/animated.gif',
      mimeType: 'image/gif',
      width: 800,
      height: 600,
      fileName: 'animated.gif',
    };

    await expect(prepareMomentMediaForUpload(selected)).resolves.toBe(selected);
  });

  it('does not process videos as images', async () => {
    const video = {
      kind: 'video' as const,
      uri: 'file:///library/clip.mp4',
      mimeType: 'video/mp4',
      width: 1920,
      height: 1080,
      durationMs: 9000,
      fileName: 'clip.mp4',
    };

    await expect(prepareMomentMediaForUpload(video)).resolves.toBe(video);
    expect(mockManipulateAsync).not.toHaveBeenCalled();
  });
});
