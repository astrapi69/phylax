import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  prepare,
  prepareWithConsent,
  UnsupportedSourceError,
  HeicHeifNotSupportedError,
} from './prepare';
import { DocumentSizeLimitError, DOCUMENT_SIZE_LIMIT_BYTES } from '../../db/repositories';
import { __resetConsentSession } from './consent';
import * as preparePdfModule from './preparePdf';
import * as prepareImageModule from './prepareImage';

function makeFile(parts: BlobPart[], filename: string, type: string): File {
  return new File(parts, filename, { type });
}

beforeEach(() => {
  __resetConsentSession();
  vi.restoreAllMocks();
});

describe('prepare() - text path', () => {
  it('round-trips a text/plain file into a ready text-mode PreparedInput', async () => {
    const file = makeFile(['Hallo, das ist eine medizinische Notiz.'], 'note.txt', 'text/plain');

    const result = await prepare(file);

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') throw new Error('unreachable');
    expect(result.input.mode).toBe('text');
    if (result.input.mode !== 'text') throw new Error('unreachable');
    expect(result.input.textContent).toBe('Hallo, das ist eine medizinische Notiz.');
    expect(result.input.sourceFile).toEqual({
      name: 'note.txt',
      type: 'text/plain',
      size: file.size,
    });
  });

  it('round-trips a text/markdown file', async () => {
    const file = makeFile(
      ['# Arztbrief\n\nDr. Müller schreibt: Werte stabil.'],
      'letter.md',
      'text/markdown',
    );

    const result = await prepare(file);

    if (result.kind !== 'ready' || result.input.mode !== 'text') throw new Error('unreachable');
    expect(result.input.textContent).toMatch(/Arztbrief/);
    expect(result.input.textContent).toMatch(/Müller/);
    expect(result.input.sourceFile.type).toBe('text/markdown');
  });

  it('preserves UTF-8 multi-byte characters', async () => {
    const file = makeFile(['Größe: 180cm. Δοκιμή.'], 'utf8.txt', 'text/plain');
    const result = await prepare(file);
    if (result.kind !== 'ready' || result.input.mode !== 'text') throw new Error('unreachable');
    expect(result.input.textContent).toBe('Größe: 180cm. Δοκιμή.');
  });

  it('handles an empty text file', async () => {
    const file = makeFile([''], 'empty.txt', 'text/plain');
    const result = await prepare(file);
    if (result.kind !== 'ready' || result.input.mode !== 'text') throw new Error('unreachable');
    expect(result.input.textContent).toBe('');
    expect(result.input.sourceFile.size).toBe(0);
  });
});

describe('prepare() - size cap', () => {
  it('throws DocumentSizeLimitError for files exceeding the 10 MB cap', async () => {
    const oversizedBytes = new Uint8Array(DOCUMENT_SIZE_LIMIT_BYTES + 1);
    const file = makeFile([oversizedBytes], 'big.txt', 'text/plain');
    await expect(prepare(file)).rejects.toThrow(DocumentSizeLimitError);
  });

  it('size check fires before MIME dispatch', async () => {
    const oversizedBytes = new Uint8Array(DOCUMENT_SIZE_LIMIT_BYTES + 1);
    const file = makeFile([oversizedBytes], 'big.txt', 'text/plain');
    await expect(prepare(file)).rejects.toBeInstanceOf(DocumentSizeLimitError);
    await expect(prepare(file)).rejects.not.toBeInstanceOf(UnsupportedSourceError);
  });
});

describe('prepare() - HEIC / HEIF rejection', () => {
  it('throws HeicHeifNotSupportedError for image/heic with the MIME type carried', async () => {
    const file = makeFile([new Uint8Array([0])], 'photo.heic', 'image/heic');
    try {
      await prepare(file);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HeicHeifNotSupportedError);
      expect((err as HeicHeifNotSupportedError).mimeType).toBe('image/heic');
    }
  });

  it('throws HeicHeifNotSupportedError for image/heif', async () => {
    const file = makeFile([new Uint8Array([0])], 'photo.heif', 'image/heif');
    await expect(prepare(file)).rejects.toBeInstanceOf(HeicHeifNotSupportedError);
  });

  it('HEIC error is distinct from UnsupportedSourceError', async () => {
    const file = makeFile([new Uint8Array([0])], 'photo.heic', 'image/heic');
    await expect(prepare(file)).rejects.not.toBeInstanceOf(UnsupportedSourceError);
  });
});

describe('prepare() - unrelated MIMEs', () => {
  it('throws UnsupportedSourceError for application/octet-stream', async () => {
    const file = makeFile([new Uint8Array([0])], 'data.bin', 'application/octet-stream');
    await expect(prepare(file)).rejects.toThrow(UnsupportedSourceError);
  });

  it('UnsupportedSourceError carries the rejected MIME type', async () => {
    const file = makeFile([new Uint8Array([0])], 'odd.xyz', 'application/x-weird');
    try {
      await prepare(file);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedSourceError);
      expect((err as UnsupportedSourceError).mimeType).toBe('application/x-weird');
    }
  });
});

describe('prepare() - PDF dispatch (preparePdf mocked)', () => {
  it('returns ready text-mode when PDF has a usable text layer', async () => {
    vi.spyOn(preparePdfModule, 'preparePdfNoConsentNeeded').mockResolvedValueOnce({
      mode: 'text',
      textContent: 'Lab values…',
      sourceFile: { name: 'lab.pdf', type: 'application/pdf', size: 4 },
    });
    const file = makeFile([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'lab.pdf', 'application/pdf');

    const result = await prepare(file);

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready' || result.input.mode !== 'text') throw new Error('unreachable');
    expect(result.input.textContent).toBe('Lab values…');
  });

  it('returns consent-required when the PDF lacks a text layer', async () => {
    vi.spyOn(preparePdfModule, 'preparePdfNoConsentNeeded').mockResolvedValueOnce(null);
    const file = makeFile([new Uint8Array([0x25])], 'scan.pdf', 'application/pdf');

    const result = await prepare(file);

    expect(result.kind).toBe('consent-required');
    if (result.kind !== 'consent-required') throw new Error('unreachable');
    expect(result.reason).toBe('pdf-rasterization');
    expect(result.file).toBe(file);
  });

  it('skips consent-required when session-grant is in effect', async () => {
    vi.spyOn(preparePdfModule, 'preparePdfNoConsentNeeded').mockResolvedValue(null);
    const rasterSpy = vi.spyOn(preparePdfModule, 'preparePdfWithRasterization').mockResolvedValue({
      mode: 'multimodal',
      textContent: '',
      imageData: [new ArrayBuffer(1)],
      sourceFile: { name: 'scan.pdf', type: 'application/pdf', size: 1 },
    });
    const file = makeFile([new Uint8Array([0x25])], 'scan.pdf', 'application/pdf');

    // First call: caller goes through prepareWithConsent with rememberForSession=true.
    await prepareWithConsent(file, { rememberForSession: true });
    expect(rasterSpy).toHaveBeenCalledTimes(1);

    // Second call to prepare(): consent already granted for session,
    // rasterization fires immediately, no consent-required round trip.
    const result = await prepare(file);
    expect(result.kind).toBe('ready');
    expect(rasterSpy).toHaveBeenCalledTimes(2);
  });
});

describe('prepare() - image dispatch (prepareImage mocked)', () => {
  it('returns ready image-mode for PNG', async () => {
    vi.spyOn(prepareImageModule, 'prepareImage').mockResolvedValueOnce({
      mode: 'image',
      imageData: new ArrayBuffer(8),
      sourceFile: { name: 'scan.png', type: 'image/png', size: 8 },
    });
    const file = makeFile([new Uint8Array([0x89, 0x50])], 'scan.png', 'image/png');

    const result = await prepare(file);

    if (result.kind !== 'ready' || result.input.mode !== 'image') throw new Error('unreachable');
    expect(result.input.imageData.byteLength).toBe(8);
    expect(result.input.sourceFile.type).toBe('image/png');
  });

  it('routes JPEG and WebP through prepareImage', async () => {
    const spy = vi.spyOn(prepareImageModule, 'prepareImage').mockResolvedValue({
      mode: 'image',
      imageData: new ArrayBuffer(2),
      sourceFile: { name: 'x', type: 'image/jpeg', size: 2 },
    });
    const jpeg = makeFile([new Uint8Array([0xff, 0xd8])], 'a.jpg', 'image/jpeg');
    const webp = makeFile([new Uint8Array([0x52, 0x49])], 'a.webp', 'image/webp');

    await prepare(jpeg);
    await prepare(webp);

    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('prepareWithConsent() - defensive non-PDF re-route', () => {
  it('re-routes a non-PDF file through prepare() and returns ready when it succeeds', async () => {
    const file = makeFile(['plain text'], 'note.txt', 'text/plain');

    const result = await prepareWithConsent(file);

    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready' || result.input.mode !== 'text') throw new Error('unreachable');
    expect(result.input.textContent).toBe('plain text');
  });
});

describe('prepareWithConsent()', () => {
  it('rasterizes when called on a PDF after consent', async () => {
    const rasterSpy = vi
      .spyOn(preparePdfModule, 'preparePdfWithRasterization')
      .mockResolvedValueOnce({
        mode: 'multimodal',
        textContent: 'partial text',
        imageData: [new ArrayBuffer(4)],
        sourceFile: { name: 's.pdf', type: 'application/pdf', size: 4 },
      });
    const file = makeFile([new Uint8Array([0x25])], 's.pdf', 'application/pdf');

    const result = await prepareWithConsent(file);

    expect(rasterSpy).toHaveBeenCalledOnce();
    if (result.kind !== 'ready' || result.input.mode !== 'multimodal') {
      throw new Error('unreachable');
    }
    expect(result.input.imageData.length).toBe(1);
    expect(result.input.textContent).toBe('partial text');
  });

  it('rememberForSession persists consent across page-load lifetime (until __reset)', async () => {
    vi.spyOn(preparePdfModule, 'preparePdfWithRasterization').mockResolvedValue({
      mode: 'multimodal',
      textContent: '',
      imageData: [],
      sourceFile: { name: 's.pdf', type: 'application/pdf', size: 0 },
    });
    const file = makeFile([new Uint8Array([0x25])], 's.pdf', 'application/pdf');

    await prepareWithConsent(file, { rememberForSession: true });
    const { isConsentGranted } = await import('./consent');
    expect(isConsentGranted('pdf-rasterization')).toBe(true);

    __resetConsentSession();
    expect(isConsentGranted('pdf-rasterization')).toBe(false);
  });
});
