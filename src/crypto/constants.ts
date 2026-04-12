/** Length of the initialization vector in bytes. AES-GCM requires exactly 12. */
export const IV_LENGTH = 12;

/** Length of the authentication tag in bytes. AES-GCM produces a 128-bit (16 byte) tag. */
export const AUTH_TAG_LENGTH = 16;

/** Algorithm identifier for Web Crypto API calls. */
export const ALGORITHM = 'AES-GCM' as const;
