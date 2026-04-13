/** Length of the initialization vector in bytes. AES-GCM requires exactly 12. */
export const IV_LENGTH = 12;

/** Length of the authentication tag in bytes. AES-GCM produces a 128-bit (16 byte) tag. */
export const AUTH_TAG_LENGTH = 16;

/** Algorithm identifier for Web Crypto API calls. */
export const ALGORITHM = 'AES-GCM' as const;

/** Number of PBKDF2 iterations. 600k is the chosen security-UX tradeoff. */
export const PBKDF2_ITERATIONS = 600_000;

/** Hash algorithm used by PBKDF2. */
export const PBKDF2_HASH = 'SHA-256' as const;

/** Length of the salt in bytes. 32 bytes = 256 bits of entropy per user. */
export const SALT_LENGTH = 32;

/** Length of the derived AES key in bits. */
export const DERIVED_KEY_LENGTH = 256;
