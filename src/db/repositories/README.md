# src/db/repositories

Repository implementations for each domain entity. Each repository takes plaintext objects in and returns plaintext objects out. Encryption and decryption happen internally, transparent to callers.

## What does NOT belong here

- No React imports. Repositories are called by features and domain services, not by components directly.
- No raw Dexie table access from outside this folder. Components and domain modules use repository methods.
- No business logic beyond encrypt-persist and fetch-decrypt.

## Planned contents

- `entryRepository.ts` (F-11, E-03): CRUD for all five entry types, encrypted storage
- `documentRepository.ts` (D-01): store and retrieve encrypted document blobs with metadata
- `index.ts`: public API re-exports
