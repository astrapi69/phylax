# src/features/onboarding

Master password setup and unlock flow. First-time users set a master password; returning users unlock with their existing password.

This feature orchestrates the crypto module (key derivation, key store) and provides the UI for password entry, confirmation, and error handling. It shows a spinner during PBKDF2 derivation to avoid UI freezes.

## What does NOT belong here

- No direct `crypto.subtle` calls. Use `src/crypto/` public API.
- No Dexie imports. Salt storage goes through `src/db/`.
- No domain logic for entries or documents.

## Planned contents

- `SetPassword.tsx` (F-12): master password creation form with confirmation
- `Unlock.tsx` (F-13): unlock screen, password input, error on wrong password
- `index.ts`: public API re-exports
