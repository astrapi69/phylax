import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBackup, BACKUP_MIME_TYPE } from './downloadBackup';

describe('downloadBackup', () => {
  let createObjectURL: typeof URL.createObjectURL;
  let revokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    createObjectURL = URL.createObjectURL;
    revokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it('declares application/json as the MIME type', () => {
    expect(BACKUP_MIME_TYPE).toBe('application/json');
  });

  it('creates a Blob URL and revokes it', () => {
    downloadBackup('{"type":"phylax-backup"}', 'phylax-backup-test.phylax');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('appends and removes an anchor with the download attribute', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    downloadBackup('{}', 'phylax-backup-test.phylax');
    const anchor = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor).toBeDefined();
    expect(anchor.download).toBe('phylax-backup-test.phylax');
    expect(removeSpy).toHaveBeenCalledWith(anchor);
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
