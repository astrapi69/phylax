# src/features/backup

Backup export and restore UI. Users can download an encrypted backup file and restore it on the same or another device.

The export flow serializes all entries and documents, encrypts with a separate key derivation, and downloads the file. The restore flow reads the file, prompts for the password, decrypts, verifies the checksum, and replaces the local database after user confirmation.

## What does NOT belong here

- No direct `crypto.subtle` calls. Backup encryption goes through `src/crypto/`.
- No Dexie imports. Database operations go through repositories.
- No backup format logic. Serialization and deserialization belong in `src/domain/backup/`.

## Planned contents

- `BackupExport.tsx` (B-02): export flow with progress indicator
- `BackupImport.tsx` (B-03): file picker, password prompt, decrypt, verify
- `RestoreConfirm.tsx` (B-04): overwrite warning and confirmation modal
- `index.ts`: public API re-exports
