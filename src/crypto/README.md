# src/crypto

Web Crypto API wrapper. AES-256-GCM encryption, PBKDF2 key derivation, in-memory key store.

This is the ONLY module in the project allowed to import `crypto.subtle`. ESLint enforces this in task F-03. The key derived from the master password lives here in a module-level variable and is never passed outside this module; repositories receive an unlocked repository instance instead.

## What does NOT belong here

- No React imports. This is a pure TypeScript module.
- No Dexie imports. Storage is handled by `src/db/`.
- No domain logic, validation, or business rules.
- No UI concerns (toasts, modals, spinners).

## Planned contents

- `constants.ts` (F-08): PBKDF2 iterations, IV length, key length
- `aesGcm.ts` (F-07): encrypt and decrypt with AES-256-GCM, round-trip tested
- `keyDerivation.ts` (F-08): PBKDF2 with salt, 600k iterations
- `keyStore.ts` (F-09): in-memory key holder, lock/unlock API, auto-clear on lock
- `index.ts`: public API re-exports
