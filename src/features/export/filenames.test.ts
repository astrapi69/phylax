import { describe, it, expect } from 'vitest';
import { generateMarkdownFilename, generatePdfFilename, generateCsvFilename } from './filenames';

describe('filenames', () => {
  const fixedDate = new Date(Date.UTC(2026, 3, 18, 14, 30));

  it('generateMarkdownFilename uses befaro-profil- base and YYYY-MM-DD suffix', () => {
    expect(generateMarkdownFilename(fixedDate)).toBe('befaro-profil-2026-04-18.md');
  });

  it('generatePdfFilename shares the befaro-profil- base with .pdf extension', () => {
    expect(generatePdfFilename(fixedDate)).toBe('befaro-profil-2026-04-18.pdf');
  });

  it('generateCsvFilename uses befaro-labor- base because CSV is lab-only', () => {
    expect(generateCsvFilename(fixedDate)).toBe('befaro-labor-2026-04-18.csv');
  });
});
