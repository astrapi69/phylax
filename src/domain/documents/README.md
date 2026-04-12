# src/domain/documents

Type definitions, validation, and business logic for uploaded documents (PDFs, images).

Documents are linked to entries and stored as encrypted blobs. This module defines the metadata shape, file type validation, and size limit enforcement. It does not handle the actual blob encryption or storage.

## What does NOT belong here

- No React imports. Document UI belongs in `src/features/documents/`.
- No Dexie imports. Blob storage belongs in `src/db/repositories/`.
- No crypto calls. Encryption is transparent at the repository level.
- No file I/O or browser APIs. Those belong in feature components.

## Planned contents

- `types.ts` (D-01): document metadata interface, supported MIME types
- `validation.ts` (D-02): file size limit (10MB), type validation
- `index.ts`: public API re-exports
