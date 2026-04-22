import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/meta', () => ({
  metaExists: vi.fn(),
}));

vi.mock('../crypto', () => ({
  getLockState: vi.fn(),
}));

import { resolveAuthState } from './resolveAuthState';
import { metaExists } from '../db/meta';
import { getLockState } from '../crypto';

describe('resolveAuthState', () => {
  beforeEach(() => {
    vi.mocked(metaExists).mockReset();
    vi.mocked(getLockState).mockReset();
  });

  it('returns "no-vault" when no meta row exists', async () => {
    vi.mocked(metaExists).mockResolvedValue(false);
    await expect(resolveAuthState()).resolves.toBe('no-vault');
    // getLockState is not consulted when there is no vault.
    expect(vi.mocked(getLockState)).not.toHaveBeenCalled();
  });

  it('returns "locked" when meta exists and the keystore is locked', async () => {
    vi.mocked(metaExists).mockResolvedValue(true);
    vi.mocked(getLockState).mockReturnValue('locked');
    await expect(resolveAuthState()).resolves.toBe('locked');
  });

  it('returns "unlocked" when meta exists and the keystore is unlocked', async () => {
    vi.mocked(metaExists).mockResolvedValue(true);
    vi.mocked(getLockState).mockReturnValue('unlocked');
    await expect(resolveAuthState()).resolves.toBe('unlocked');
  });

  it('propagates metaExists() rejections so consumers can decide fail policy', async () => {
    vi.mocked(metaExists).mockRejectedValue(new Error('indexeddb unavailable'));
    await expect(resolveAuthState()).rejects.toThrow('indexeddb unavailable');
  });
});
