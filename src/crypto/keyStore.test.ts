// @vitest-environment node
//
// This test file uses dynamic imports with vi.resetModules()
// to get a fresh keyStore module instance per test.
// Do not add static imports of './keyStore' - it would bypass the reset
// and tests would leak state across each other.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateSalt } from './keyDerivation';
import type { LockState } from './keyStore';

let keyStore: typeof import('./keyStore');
let salt: Uint8Array;

beforeEach(async () => {
  vi.resetModules();
  keyStore = await import('./keyStore');
  salt = generateSalt();
});

describe('key store', () => {
  describe('state transitions', () => {
    it('initial state is locked', () => {
      expect(keyStore.getLockState()).toBe('locked');
    });

    it('unlock transitions to unlocked', async () => {
      await keyStore.unlock('password', salt);
      expect(keyStore.getLockState()).toBe('unlocked');
    });

    it('unlock when already unlocked throws', async () => {
      await keyStore.unlock('password', salt);
      await expect(keyStore.unlock('password', salt)).rejects.toThrow('Key store already unlocked');
    });

    it('lock transitions to locked', async () => {
      await keyStore.unlock('password', salt);
      keyStore.lock();
      expect(keyStore.getLockState()).toBe('locked');
    });

    it('lock when already locked is a no-op', () => {
      keyStore.lock();
      expect(keyStore.getLockState()).toBe('locked');
    });
  });

  describe('encrypt/decrypt gating', () => {
    it('encrypt when locked throws', async () => {
      await expect(keyStore.encryptWithStoredKey(new Uint8Array([1]))).rejects.toThrow(
        'Key store is locked',
      );
    });

    it('decrypt when locked throws', async () => {
      await expect(keyStore.decryptWithStoredKey(new Uint8Array([1]))).rejects.toThrow(
        'Key store is locked',
      );
    });
  });

  describe('crypto correctness', () => {
    it('round trip via the store', async () => {
      await keyStore.unlock('password', salt);

      const plaintext = new Uint8Array([10, 20, 30, 40, 50]);
      const ciphertext = await keyStore.encryptWithStoredKey(plaintext);
      const decrypted = await keyStore.decryptWithStoredKey(ciphertext);

      expect(decrypted).toEqual(plaintext);
    });

    it('cross-instance isolation: re-derived key from different password cannot decrypt', async () => {
      await keyStore.unlock('password-alpha', salt);
      const ciphertext = await keyStore.encryptWithStoredKey(new Uint8Array([1, 2, 3]));
      keyStore.lock();

      await keyStore.unlock('password-beta', salt);
      await expect(keyStore.decryptWithStoredKey(ciphertext)).rejects.toThrow();
    });
  });

  describe('listeners', () => {
    it('fires on unlock', async () => {
      const calls: LockState[] = [];
      keyStore.onLockStateChange((state) => calls.push(state));

      await keyStore.unlock('password', salt);

      expect(calls).toEqual(['unlocked']);
    });

    it('fires on lock', async () => {
      await keyStore.unlock('password', salt);

      const calls: LockState[] = [];
      keyStore.onLockStateChange((state) => calls.push(state));
      keyStore.lock();

      expect(calls).toEqual(['locked']);
    });

    it('does NOT fire on no-op lock', () => {
      const calls: LockState[] = [];
      keyStore.onLockStateChange((state) => calls.push(state));

      keyStore.lock();

      expect(calls).toEqual([]);
    });

    it('does NOT fire twice on failed second unlock', async () => {
      const calls: LockState[] = [];
      keyStore.onLockStateChange((state) => calls.push(state));

      await keyStore.unlock('password', salt);

      try {
        await keyStore.unlock('password', salt);
      } catch {
        // expected
      }

      expect(calls).toEqual(['unlocked']);
    });

    it('unsubscribe works', async () => {
      const calls: LockState[] = [];
      const unsub = keyStore.onLockStateChange((state) => calls.push(state));

      unsub();
      await keyStore.unlock('password', salt);

      expect(calls).toEqual([]);
    });

    it('multiple listeners fire in insertion order', async () => {
      const order: number[] = [];
      keyStore.onLockStateChange(() => order.push(1));
      keyStore.onLockStateChange(() => order.push(2));
      keyStore.onLockStateChange(() => order.push(3));

      await keyStore.unlock('password', salt);

      expect(order).toEqual([1, 2, 3]);
    });

    it('a throwing listener does not break others', async () => {
      const calls: string[] = [];

      keyStore.onLockStateChange(() => {
        throw new Error('listener A explodes');
      });
      keyStore.onLockStateChange(() => {
        calls.push('B called');
      });

      // Suppress the console.error from the caught listener error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await keyStore.unlock('password', salt);

      expect(calls).toEqual(['B called']);
      expect(consoleSpy).toHaveBeenCalledOnce();

      consoleSpy.mockRestore();
    });

    it('passes the new state to the listener on transition', async () => {
      const received: LockState[] = [];
      keyStore.onLockStateChange((state) => received.push(state));

      await keyStore.unlock('password', salt);
      keyStore.lock();

      expect(received).toEqual(['unlocked', 'locked']);
    });

    it('memory leak sanity: unsubscribed listeners are not called', async () => {
      const calls: number[] = [];
      const unsubs: (() => void)[] = [];

      for (let i = 0; i < 1000; i++) {
        unsubs.push(keyStore.onLockStateChange(() => calls.push(i)));
      }

      for (const unsub of unsubs) {
        unsub();
      }

      await keyStore.unlock('password', salt);

      expect(calls).toEqual([]);
    });
  });
});
