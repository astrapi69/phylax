export { encrypt, decrypt } from './aesGcm';
export { generateId } from './generateId';
export { deriveKeyFromPassword, generateSalt } from './keyDerivation';
export type { LockState } from './keyStore';
export {
  getLockState,
  unlock,
  unlockWithKey,
  lock,
  encryptWithStoredKey,
  decryptWithStoredKey,
  onLockStateChange,
} from './keyStore';
export {
  IV_LENGTH,
  AUTH_TAG_LENGTH,
  ALGORITHM,
  PBKDF2_ITERATIONS,
  PBKDF2_HASH,
  SALT_LENGTH,
  DERIVED_KEY_LENGTH,
} from './constants';
