import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prepareImage, ImageDimensionLimitError, MAX_IMAGE_EDGE_PX } from './prepareImage';

/**
 * jsdom does not implement image-decode for `HTMLImageElement`
 * (`naturalWidth` / `naturalHeight` stay 0 and `onload` never fires
 * without the polyfill). Patch the Image constructor for the
 * duration of these tests so dimension probes resolve with the
 * caller-supplied values.
 */
let nextDimensions: { width: number; height: number; shouldError?: boolean } = {
  width: 100,
  height: 100,
};

beforeEach(() => {
  nextDimensions = { width: 100, height: 100 };
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_value: string) {
        setTimeout(() => {
          if (nextDimensions.shouldError) {
            this.onerror?.();
            return;
          }
          this.naturalWidth = nextDimensions.width;
          this.naturalHeight = nextDimensions.height;
          this.onload?.();
        }, 0);
      }
    },
  );
  // jsdom URL.createObjectURL stub if missing (matches D-04 pattern)
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    URL.revokeObjectURL = vi.fn();
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeImageFile(): File {
  return new File([new Uint8Array([0x89, 0x50])], 'scan.png', { type: 'image/png' });
}

describe('prepareImage', () => {
  it('returns image-mode PreparedInput with the file ArrayBuffer', async () => {
    nextDimensions = { width: 1024, height: 768 };
    const file = makeImageFile();

    const result = await prepareImage(file);

    expect(result.mode).toBe('image');
    if (result.mode !== 'image') throw new Error('unreachable');
    expect(result.imageData.byteLength).toBe(file.size);
    expect(result.sourceFile).toEqual({
      name: 'scan.png',
      type: 'image/png',
      size: file.size,
    });
  });

  it('accepts images at the dimension cap (8000px on edge)', async () => {
    nextDimensions = { width: MAX_IMAGE_EDGE_PX, height: MAX_IMAGE_EDGE_PX };
    const result = await prepareImage(makeImageFile());
    expect(result.mode).toBe('image');
  });

  it('throws ImageDimensionLimitError when width exceeds the cap', async () => {
    nextDimensions = { width: MAX_IMAGE_EDGE_PX + 1, height: 100 };
    try {
      await prepareImage(makeImageFile());
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ImageDimensionLimitError);
      expect((err as ImageDimensionLimitError).width).toBe(MAX_IMAGE_EDGE_PX + 1);
      expect((err as ImageDimensionLimitError).height).toBe(100);
      expect((err as ImageDimensionLimitError).limitPx).toBe(MAX_IMAGE_EDGE_PX);
    }
  });

  it('throws ImageDimensionLimitError when height exceeds the cap', async () => {
    nextDimensions = { width: 100, height: MAX_IMAGE_EDGE_PX + 1 };
    await expect(prepareImage(makeImageFile())).rejects.toBeInstanceOf(ImageDimensionLimitError);
  });

  it('rejects when the image-header read fails', async () => {
    nextDimensions = { width: 0, height: 0, shouldError: true };
    await expect(prepareImage(makeImageFile())).rejects.toThrow(/decode image header/);
  });
});
