import { describe, it, expect } from 'vitest';
import { prepare, UnsupportedSourceError } from './prepare';
import { DocumentSizeLimitError, DOCUMENT_SIZE_LIMIT_BYTES } from '../../db/repositories';

function makeFile(parts: BlobPart[], filename: string, type: string): File {
  return new File(parts, filename, { type });
}

describe('prepare()', () => {
  it('round-trips a text/plain file into a text-mode PreparedInput', async () => {
    const file = makeFile(['Hallo, das ist eine medizinische Notiz.'], 'note.txt', 'text/plain');

    const result = await prepare(file);

    expect(result.mode).toBe('text');
    if (result.mode !== 'text') throw new Error('unreachable');
    expect(result.textContent).toBe('Hallo, das ist eine medizinische Notiz.');
    expect(result.sourceFile).toEqual({
      name: 'note.txt',
      type: 'text/plain',
      size: file.size,
    });
  });

  it('round-trips a text/markdown file into a text-mode PreparedInput', async () => {
    const file = makeFile(
      ['# Arztbrief\n\nDr. Müller schreibt: Werte stabil.'],
      'letter.md',
      'text/markdown',
    );

    const result = await prepare(file);

    expect(result.mode).toBe('text');
    if (result.mode !== 'text') throw new Error('unreachable');
    expect(result.textContent).toMatch(/Arztbrief/);
    expect(result.textContent).toMatch(/Müller/);
    expect(result.sourceFile.name).toBe('letter.md');
    expect(result.sourceFile.type).toBe('text/markdown');
  });

  it('preserves UTF-8 multi-byte characters (German umlauts, Greek)', async () => {
    const file = makeFile(['Größe: 180cm. Δοκιμή.'], 'utf8.txt', 'text/plain');

    const result = await prepare(file);

    if (result.mode !== 'text') throw new Error('unreachable');
    expect(result.textContent).toBe('Größe: 180cm. Δοκιμή.');
  });

  it('throws DocumentSizeLimitError for files exceeding the 10 MB cap', async () => {
    // Construct a File whose .size exceeds the cap without actually
    // allocating 10 MB of bytes (jsdom would happily accept a large
    // ArrayBuffer but the test stays cheap by using a stub that
    // reports an oversized size).
    const oversizedBytes = new Uint8Array(DOCUMENT_SIZE_LIMIT_BYTES + 1);
    const file = makeFile([oversizedBytes], 'big.txt', 'text/plain');

    await expect(prepare(file)).rejects.toThrow(DocumentSizeLimitError);
  });

  it('size check fires before MIME dispatch (oversized text/plain still rejected)', async () => {
    const oversizedBytes = new Uint8Array(DOCUMENT_SIZE_LIMIT_BYTES + 1);
    const file = makeFile([oversizedBytes], 'big.txt', 'text/plain');

    await expect(prepare(file)).rejects.toBeInstanceOf(DocumentSizeLimitError);
    await expect(prepare(file)).rejects.not.toBeInstanceOf(UnsupportedSourceError);
  });

  it('throws UnsupportedSourceError for application/pdf (IMP-02 territory)', async () => {
    const file = makeFile([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'doc.pdf', 'application/pdf');

    await expect(prepare(file)).rejects.toThrow(UnsupportedSourceError);
    await expect(prepare(file)).rejects.toMatchObject({ mimeType: 'application/pdf' });
  });

  it('throws UnsupportedSourceError for image MIME types (IMP-02 territory)', async () => {
    const png = makeFile([new Uint8Array([0x89, 0x50])], 'scan.png', 'image/png');
    const jpeg = makeFile([new Uint8Array([0xff, 0xd8])], 'scan.jpg', 'image/jpeg');
    const webp = makeFile([new Uint8Array([0x52, 0x49])], 'scan.webp', 'image/webp');

    await expect(prepare(png)).rejects.toThrow(UnsupportedSourceError);
    await expect(prepare(jpeg)).rejects.toThrow(UnsupportedSourceError);
    await expect(prepare(webp)).rejects.toThrow(UnsupportedSourceError);
  });

  it('throws UnsupportedSourceError for unrelated MIME types', async () => {
    const file = makeFile([new Uint8Array([0])], 'data.bin', 'application/octet-stream');

    await expect(prepare(file)).rejects.toThrow(UnsupportedSourceError);
  });

  it('UnsupportedSourceError carries the rejected MIME type for diagnostics', async () => {
    const file = makeFile([new Uint8Array([0])], 'odd.xyz', 'application/x-weird');

    try {
      await prepare(file);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedSourceError);
      expect((err as UnsupportedSourceError).mimeType).toBe('application/x-weird');
      expect((err as UnsupportedSourceError).name).toBe('UnsupportedSourceError');
    }
  });

  it('handles an empty text file (zero-length content)', async () => {
    const file = makeFile([''], 'empty.txt', 'text/plain');

    const result = await prepare(file);

    if (result.mode !== 'text') throw new Error('unreachable');
    expect(result.textContent).toBe('');
    expect(result.sourceFile.size).toBe(0);
  });
});
