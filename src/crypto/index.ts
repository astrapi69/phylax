export { encrypt, decrypt } from './aesGcm';
export { deriveKeyFromPassword, generateSalt } from './keyDerivation';
export type { LockState } from './keyStore';
export {
  getLockState,
  unlock,
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
