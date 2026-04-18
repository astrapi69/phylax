import { describe, it, expect } from 'vitest';
import { generateMarkdownFilename, generatePdfFilename, generateCsvFilename } from './filenames';

describe('filenames', () => {
  const fixedDate = new Date(Date.UTC(2026, 3, 18, 14, 30));

  it('generateMarkdownFilename uses phylax-profil- base and YYYY-MM-DD suffix', () => {
    expect(generateMarkdownFilename(fixedDate)).toBe('phylax-profil-2026-04-18.md');
  });

  it('generatePdfFilename shares the phylax-profil- base with .pdf extension', () => {
    expect(generatePdfFilename(fixedDate)).toBe('phylax-profil-2026-04-18.pdf');
  });

  it('generateCsvFilename uses phylax-labor- base because CSV is lab-only', () => {
    expect(generateCsvFilename(fixedDate)).toBe('phylax-labor-2026-04-18.csv');
  });
});
