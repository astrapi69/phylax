# src/domain

Pure business logic layer. Type definitions, validation rules, and transformations. No framework dependencies.

This layer defines interfaces that the storage layer implements. It never imports from React or Dexie directly. All code here is plain TypeScript, easily testable without a browser environment.

## What does NOT belong here

- No React imports. Domain logic is framework-agnostic.
- No Dexie imports. Storage access goes through repository interfaces.
- No `crypto.subtle` calls. Encryption is handled by `src/crypto/`.
- No UI concerns (components, hooks, styles).

## Planned contents

- `entries/` (E-01, E-02): type definitions and validation for the five entry types
- `documents/` (D-01): document metadata types and validation
- `backup/` (B-01): backup file format spec, serialization logic
- `index.ts`: public API re-exports
