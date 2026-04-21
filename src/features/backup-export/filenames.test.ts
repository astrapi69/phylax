import { describe, it, expect } from 'vitest';
import { formatBackupFilename } from './filenames';

describe('formatBackupFilename', () => {
  it('formats a known date as phylax-backup-YYYYMMDD-HHmmss.phylax', () => {
    const d = new Date(2026, 3, 21, 17, 30, 12); // local time, April 21 2026 17:30:12
    expect(formatBackupFilename(d)).toBe('phylax-backup-20260421-173012.phylax');
  });

  it('zero-pads single-digit month, day, hour, minute, second', () => {
    const d = new Date(2026, 0, 3, 5, 7, 9);
    expect(formatBackupFilename(d)).toBe('phylax-backup-20260103-050709.phylax');
  });

  it('produces distinct filenames one second apart', () => {
    const a = new Date(2026, 3, 21, 17, 30, 10);
    const b = new Date(2026, 3, 21, 17, 30, 11);
    expect(formatBackupFilename(a)).not.toBe(formatBackupFilename(b));
  });

  it('defaults to the current wall-clock time', () => {
    const name = formatBackupFilename();
    expect(name).toMatch(/^phylax-backup-\d{8}-\d{6}\.phylax$/);
  });
});
