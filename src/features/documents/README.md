# src/features/documents

Document upload, viewing, and management UI. Supports PDFs and images, stored as encrypted blobs linked to entries.

Handles file selection, size/type validation feedback, thumbnail generation for images, and document-to-entry linking. The actual encryption and blob storage are handled by the document repository.

## What does NOT belong here

- No direct `crypto.subtle` calls. Encryption is transparent at the repository level.
- No Dexie imports. Blob storage goes through `src/db/repositories/`.
- No document type definitions. Those belong in `src/domain/documents/`.

## Planned contents

- `FileUpload.tsx` (D-02): file picker with size limit (10MB) and type validation
- `DocumentList.tsx` (D-04): list view with thumbnails for images
- `PdfViewer.tsx` (D-05): PDF display using native browser rendering
- `ImageViewer.tsx` (D-06): image display with zoom
- `DocumentLink.tsx` (D-07): link documents to entries
- `StorageQuota.tsx` (D-09): used vs available storage indicator
- `index.ts`: public API re-exports
