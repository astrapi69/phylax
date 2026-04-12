# src/features

React feature folders, one per user-facing area. Each feature owns its components, hooks, and feature-local state.

Features call domain modules for business logic and repositories for data access. They never call `crypto.subtle` or Dexie directly. Global state (auth/lock state, theme, locale) lives in React Context, not in feature folders.

## What does NOT belong here

- No `crypto.subtle` calls. Use `src/crypto/` via repositories.
- No Dexie imports. Use repositories from `src/db/`.
- No shared UI components. Those belong in `src/ui/`.
- No domain logic. Validation and transformations belong in `src/domain/`.

## Planned contents

- `onboarding/` (F-12, F-13): master password setup and unlock flow
- `entries/` (E-04 to E-13): CRUD forms, list views, detail views, timeline, search
- `documents/` (D-02 to D-10): upload, viewer, linking to entries
- `export/` (X-01 to X-07): PDF report generator, CSV export, date range selector
- `backup/` (B-02 to B-07): backup export and restore UI
- `settings/` (P-05, P-06): auto-lock timeout, language, theme, change master password
