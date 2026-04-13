# src/domain

Pure business logic layer. Type definitions for the living health profile entities. No framework dependencies.

This layer defines the shapes that the storage layer persists. It never imports from React or Dexie directly. All code here is plain TypeScript, easily testable without a browser environment.

## What does NOT belong here

- No React imports. Domain logic is framework-agnostic.
- No Dexie imports. Storage access goes through repository interfaces in `src/db/repositories/`.
- No `crypto.subtle` calls. Encryption is handled by `src/crypto/`.
- No UI concerns (components, hooks, styles).

## Current contents

- `profile/types.ts`: Profile, BaseData, DoctorInfo, WeightEntry
- `observation/types.ts`: Observation, ObservationStatus, Source
- `labValue/types.ts`: LabReport, LabValue
- `supplement/types.ts`: Supplement, SupplementCategory
- `openPoint/types.ts`: OpenPoint, OpenPointContext
- `profileVersion/types.ts`: ProfileVersion
- `timelineEntry/types.ts`: TimelineEntry
- `index.ts`: public API re-exports

## Future additions

When document upload support is implemented (currently placeholder in Dexie schema), a `document/` subdirectory with its own types will be added. When backup format logic lands (Phase 6 territory), a `backup/` subdirectory will be added. Neither exists yet; stale scaffolds were removed after the architecture realignment cleanup.
