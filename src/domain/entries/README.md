# src/domain/entries

Type definitions, validation rules, and business logic for the five entry types: symptom, medication, vital, appointment, and note.

All types here are plain TypeScript interfaces and type aliases. Validation functions are pure functions with no side effects. This module knows nothing about how entries are stored or displayed.

## What does NOT belong here

- No React imports. Entry rendering belongs in `src/features/entries/`.
- No Dexie imports. Persistence belongs in `src/db/repositories/`.
- No crypto calls. Encryption is transparent at the repository level.

## Planned contents

- `types.ts` (E-01): interfaces for symptom, medication, vital, appointment, note
- `validation.ts` (E-02): date sanity checks, required fields, length limits
- `index.ts`: public API re-exports
