import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerDownload } from './download';

describe('triggerDownload', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let originalCreate: typeof URL.createObjectURL;
  let originalRevoke: typeof URL.revokeObjectURL;

  beforeEach(() => {
    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    // Default: swallow the click so jsdom does not try to navigate.
    // Individual tests override with their own spy when they need to assert.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  it('creates a Blob with the given mime type and revokes the object URL', () => {
    triggerDownload('hello', 'greeting.txt', 'text/plain');
    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/plain');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('triggers a synthetic click on an anchor with the download attribute set', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      const anchor = document.querySelector('a[download]');
      expect(anchor).not.toBeNull();
      expect(anchor?.getAttribute('download')).toBe('greeting.txt');
      expect(anchor?.getAttribute('href')).toBe('blob:mock-url');
    });
    triggerDownload('hello', 'greeting.txt', 'text/plain');
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('accepts a pre-built Blob without re-wrapping it', () => {
    const sourceBlob = new Blob(['binary'], { type: 'application/pdf' });
    triggerDownload(sourceBlob, 'report.pdf', 'application/pdf');
    const passedBlob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(passedBlob).toBe(sourceBlob);
  });
});
