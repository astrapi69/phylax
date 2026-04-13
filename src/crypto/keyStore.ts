/**
 * In-memory key store for Phylax.
 *
 * Holds the derived AES-GCM CryptoKey while the app is unlocked.
 * No other module ever holds the key directly. Every encrypt/decrypt
 * operation goes through this store.
 *
 * Memory caveat: JavaScript does not provide deterministic memory wiping.
 * When lock() is called, the reference is nulled, but the underlying key
 * material may persist in memory until garbage collection, and may be
 * copied by the JS engine during GC or heap compaction. This is an
 * unavoidable limitation of the platform. Device-level security (OS
 * screen lock, encrypted disk) remains the last line of defense.
 */

import { encrypt, decrypt } from './aesGcm';
import { deriveKeyFromPassword } from './keyDerivation';

export type LockState = 'locked' | 'unlocked';

let currentKey: CryptoKey | null = null;
const listeners = new Set<(state: LockState) => void>();

function notifyListeners(state: LockState): void {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      console.error('Lock state listener threw:', err);
    }
  }
}

/**
 * Get the current lock state.
 *
 * @returns 'locked' if no key is held, 'unlocked' if a key is available
 */
export function getLockState(): LockState {
  return currentKey === null ? 'locked' : 'unlocked';
}

/**
 * Unlock with a master password and salt. Derives the key and holds it in memory.
 * Throws if already unlocked (caller should lock first if rotating).
 *
 * @param password - the master password
 * @param salt - the stored salt (SALT_LENGTH bytes)
 */
export async function unlock(password: string, salt: Uint8Array): Promise<void> {
  if (currentKey !== null) {
    throw new Error('Key store already unlocked');
  }

  currentKey = await deriveKeyFromPassword(password, salt);
  notifyListeners('unlocked');
}

/**
 * Unlock with a pre-derived CryptoKey. Avoids re-deriving via PBKDF2
 * when the key was just derived (e.g. during onboarding).
 * Throws if already unlocked.
 *
 * @param key - a pre-derived AES-GCM CryptoKey
 */
export function unlockWithKey(key: CryptoKey): void {
  if (currentKey !== null) {
    throw new Error('Key store already unlocked');
  }

  currentKey = key;
  notifyListeners('unlocked');
}

/**
 * Clear the in-memory key. Safe to call when already locked (no-op).
 * Listeners are only notified on actual transition from unlocked to locked.
 */
export function lock(): void {
  if (currentKey === null) {
    return;
  }

  currentKey = null;
  notifyListeners('locked');
}

/**
 * Encrypt plaintext using the currently-unlocked key.
 * Throws if the store is locked.
 *
 * @param plaintext - arbitrary bytes to encrypt
 * @returns encrypted payload (IV + ciphertext + auth tag)
 */
export async function encryptWithStoredKey(plaintext: Uint8Array): Promise<Uint8Array> {
  if (currentKey === null) {
    throw new Error('Key store is locked');
  }

  return encrypt(currentKey, plaintext);
}

/**
 * Decrypt payload using the currently-unlocked key.
 * Throws if the store is locked. Throws on wrong key or tampered payload
 * (propagated from AES-GCM).
 *
 * @param payload - encrypted payload from encryptWithStoredKey
 * @returns original plaintext bytes
 */
export async function decryptWithStoredKey(payload: Uint8Array): Promise<Uint8Array> {
  if (currentKey === null) {
    throw new Error('Key store is locked');
  }

  return decrypt(currentKey, payload);
}

/**
 * Subscribe to lock-state changes. Returns an unsubscribe function.
 * Listeners fire synchronously after state transitions. One failing
 * listener does not break others.
 *
 * @param listener - called with the new LockState on each transition
 * @returns unsubscribe function
 */
export function onLockStateChange(listener: (state: LockState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
