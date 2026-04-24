import type { PreparedInput, SourceFileMetadata } from './types';

/**
 * Maximum pixel dimension on either edge for an image upload.
 * Anthropic multimodal API caps inputs at ~8000x8000 px in practice;
 * inputs larger than this are rejected upstream and waste a round
 * trip. Catching the limit at `prepare` saves the user a failed
 * upload after they've already gone through file selection.
 */
export const MAX_IMAGE_EDGE_PX = 8000;

/**
 * Thrown when a raster image exceeds `MAX_IMAGE_EDGE_PX` on either
 * dimension. Caught upstream by the import UI for a localized error
 * message; thrown unconditionally as defense in depth.
 */
export class ImageDimensionLimitError extends Error {
  constructor(
    public readonly width: number,
    public readonly height: number,
    public readonly limitPx: number = MAX_IMAGE_EDGE_PX,
  ) {
    super(`Image exceeds dimension limit: ${width}x${height} > ${limitPx}px on one edge`);
    this.name = 'ImageDimensionLimitError';
  }
}

/**
 * Prepare a raster image (PNG / JPEG / WebP) for downstream
 * multimodal AI classification. Validates pixel dimensions against
 * the `MAX_IMAGE_EDGE_PX` cap, then wraps the file's bytes in an
 * `image`-mode `PreparedInput`.
 */
export async function prepareImage(file: File): Promise<PreparedInput> {
  const buffer = await file.arrayBuffer();
  const { width, height } = await readImageDimensions(buffer, file.type);
  if (width > MAX_IMAGE_EDGE_PX || height > MAX_IMAGE_EDGE_PX) {
    throw new ImageDimensionLimitError(width, height);
  }
  const sourceFile: SourceFileMetadata = {
    name: file.name,
    type: file.type,
    size: file.size,
  };
  return {
    mode: 'image',
    imageData: buffer,
    sourceFile,
  };
}

/**
 * Read the natural pixel dimensions of an image without decoding
 * the full pixel buffer. Uses an `HTMLImageElement` + object URL
 * because it works for all three accepted MIMEs (PNG / JPEG / WebP)
 * with one code path. The browser's image decoder reports
 * `naturalWidth` / `naturalHeight` as soon as the file header is
 * parsed, so the full image bytes are not held in JS memory beyond
 * the `Blob` already created by the caller.
 *
 * Object URL is revoked in both success and error paths.
 */
function readImageDimensions(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image header for dimension check'));
    };
    img.src = url;
  });
}
