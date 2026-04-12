# src/db

Dexie.js wrapper for IndexedDB access. Schema definition, migrations, and repository implementations.

This is the ONLY module in the project allowed to import `dexie`. ESLint enforces this in task F-03. All data is stored as `{ id, type, createdAt, updatedAt, ciphertext, iv }`. Plaintext fields are NEVER persisted. Repositories encrypt before `put` and decrypt after `get`, returning domain types to callers.

## What does NOT belong here

- No React imports. This is a pure storage layer.
- No `crypto.subtle` calls. Encryption is delegated to `src/crypto/`.
- No business logic or validation. That belongs in `src/domain/`.
- No direct Dexie usage from outside this module.

## Planned contents

- `schema.ts` (F-10): Dexie database class, table definitions, version migrations
- `repositories/` (F-11): repository implementations per domain entity
- `index.ts`: public API re-exports
