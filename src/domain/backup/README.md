# src/domain/backup

Backup file format specification, serialization, and deserialization logic.

Defines the structure of encrypted backup files: header (version, salt, KDF params), encrypted payload, and checksum. The actual encryption uses `src/crypto/` via a separate key derivation from the master password. This module handles the format, not the crypto.

## What does NOT belong here

- No React imports. Backup UI belongs in `src/features/backup/`.
- No Dexie imports. Reading all entries for export goes through repositories.
- No `crypto.subtle` calls. Key derivation and encryption are delegated to `src/crypto/`.

## Planned contents

- `types.ts` (B-01): backup file header, payload format, checksum type
- `serialization.ts` (B-02): serialize entries and documents into backup payload
- `deserialization.ts` (B-03): parse and validate backup file structure
- `index.ts`: public API re-exports
