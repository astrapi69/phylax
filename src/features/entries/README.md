# src/features/entries

CRUD UI for all five entry types: symptom, medication, vital, appointment, and note. Includes forms, list views, detail views, timeline, search, and filtering.

Each entry type has its own form component. The unified timeline view shows all entries sorted by date with type and date range filters. Search runs in-memory across decrypted entries.

## What does NOT belong here

- No direct `crypto.subtle` calls. Encryption is transparent at the repository level.
- No Dexie imports. Data access goes through repositories.
- No entry type definitions or validation. Those belong in `src/domain/entries/`.

## Planned contents

- `SymptomForm.tsx` (E-04): symptom entry form with intensity, body region, dates
- `MedicationForm.tsx` (E-05): medication form with dosage, frequency, start/end dates
- `VitalForm.tsx` (E-06): vital signs form with type selector and unit handling
- `AppointmentForm.tsx` (E-07): appointment form with doctor, specialty, outcome
- `NoteForm.tsx` (E-08): free text note with tags
- `Timeline.tsx` (E-09): unified view of all entries sorted by date
- `EntrySearch.tsx` (E-10): in-memory search across decrypted entries
- `DateRangeFilter.tsx` (E-11): date range filtering component
- `index.ts`: public API re-exports
