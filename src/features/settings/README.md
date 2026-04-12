# src/features/settings

Settings screen for user preferences: auto-lock timeout, language, theme, and master password change.

Changing the master password requires re-encrypting all records with a new key, which is handled by the crypto module and repositories. Language and theme changes update React Context.

## What does NOT belong here

- No direct `crypto.subtle` calls. Password change goes through `src/crypto/`.
- No Dexie imports. Re-encryption goes through repositories.
- No shared UI components. Those belong in `src/ui/`.

## Planned contents

- `Settings.tsx` (P-05): main settings screen with sections
- `ChangePassword.tsx` (P-06): master password change flow with re-encryption
- `index.ts`: public API re-exports
