# IM-06 Field-level merge mode

**Status:** Draft (queued behind IM-05 manual-smoke finding 2026-05-04)
**Series:** IM (import) / Phase 4 follow-up
**Author:** Asterios Raptis
**Date:** 2026-05-04

## Problem statement

The IM-05 Option B `<ConfirmDialog>` ships three modes per entity
type: **Replace** / **Add (Zusammenführen)** / **Skip**. The
manual-smoke walk
([`docs/manual-smoke/im-05-option-b-merge.md`](../manual-smoke/im-05-option-b-merge.md))
established on 2026-05-04 that none of the three modes match a
user's intuition for "merge two profiles":

- **Replace** wipes existing data. Acceptable only when the user
  explicitly intends a clean overwrite.
- **Add** creates duplicate rows for any entity that exists on
  both sides (same theme on observations, same `reportDate` on lab
  reports, same `name` on supplements, same `context` on
  open-points). No natural-key match, no field-level merge, no
  dedup. Confusing and hard to clean up.
- **Skip** discards the incoming entities entirely.

The dialog's amber duplicate-warning copy is honest about the Add
behaviour but does not fix the underlying UX: the user has no way
to import "the new bits" without either destroying their existing
data or accepting duplicates of overlapping entries.

IM-06 adds a real field-level merge so the user can import a
second profile without destroying or duplicating existing data.

## Out-of-scope

- Free-form three-way merge (origin / mine / theirs). Phylax has
  no concept of an "origin" version per entity, and the import
  source is a flat markdown document, not a versioned snapshot.
- Cross-entity merge (e.g. "this lab value moved from report A to
  report B"). Each entity type merges in isolation against its
  own natural key.
- Auto-merge of Profile-level identity data (`baseData.name`,
  `profileType`, `managedBy`, `version`). Identity data is locked
  by the Q5 invariant in IM-05 and is never touched by per-type
  modes.

## Natural keys per entity type

The match key is the user-visible identifier that two entities
"are obviously the same" on. Code references point at the parser
output that drives the comparison.

| Entity type      | Natural key                              | Source field(s)                                                      | Notes                                                                                                                                               |
| ---------------- | ---------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Observations     | `theme`                                  | `ParsedObservation.theme`                                            | Already used as the group label in `/observations` and the X-04 export theme filter. Case-sensitive trim-equality.                                  |
| Lab reports      | `reportDate`                             | `ParsedLabReport.reportDate`                                         | ISO date (`YYYY-MM-DD`). One report per calendar day per profile is the implicit invariant in the parser fixture and the sort UX.                   |
| Lab values       | `(reportId, parameter)`                  | `ParsedLabValue.parameter` scoped to the parent report's matched id. | Two values for the same parameter inside one report rarely make sense. After report-level match, value-level match is `parameter` exact.            |
| Supplements      | `name` + `brand` if present, else `name` | `ParsedSupplement.name`, `ParsedSupplement.brand`                    | `Vitamin D3` and `Vitamin D3 (Pure)` are different rows in the fixture; brand is part of the identity.                                              |
| Open-points      | `context`                                | `ParsedOpenPoint.context`                                            | Sub-bullets within a context are merged as a sub-step (see "Sub-entity behaviour" below).                                                           |
| Profile-versions | `versionLabel`                           | `ParsedProfileVersion.label`                                         | "v1.0" / "v2.0". Equal labels merge; new labels append.                                                                                             |
| Timeline entries | `date`                                   | `ParsedTimelineEntry.date`                                           | ISO timestamp; near-identical timestamps are different events. Field-level merge of duplicates is rare; in practice append on near-key-equal cases. |

## Match outcomes

For each type, after natural-key matching, every parsed entity
falls into one of three buckets:

1. **New** - no existing entity has this key. Insert. No conflict.
2. **Identical match** - existing entity has the same key and all
   other fields are equal. No-op (do not write a new row, do not
   surface conflict).
3. **Conflict match** - existing entity has the same key but at
   least one other field differs.

## Conflict-resolution UX

A second-stage modal between the IM-05 ConfirmDialog and the
import-write transaction. Visible only if at least one
conflict-match exists. Surface:

- Per-type expandable section listing each conflict (e.g.
  "Observations -> 'Linkes Knie': fact differs").
- Per-conflict picker: **Keep mine** / **Take theirs** /
  **Field-by-field**.
  - Field-by-field expands a sub-list with one row per differing
    field; each row has a Mine / Theirs radio.
- A "Apply same choice to all conflicts in this section" shortcut
  that copies the selected per-conflict choice down the section.
- A footer with two buttons: **Cancel** (returns to the
  ConfirmDialog with state preserved) / **Übernehmen**.

The modal scrolls inside its own viewport; on a 360-px viewport
the per-conflict pickers wrap onto a second row.

## Migration: how does IM-06 reshape IM-05 Option B?

The IM-05 dialog's three radios become:

| IM-05 mode (current) | IM-06 mode (proposed) | Behaviour                                                                                          |
| -------------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| Replace              | Replace               | Unchanged. Wipe existing, insert parsed.                                                           |
| Add (Zusammenführen) | Field-Merge           | Match by natural key, route conflicts to the resolution modal, insert non-matched parsed entities. |
| Skip                 | Skip                  | Unchanged. Discard parsed for this type.                                                           |

The `'add'` value of `ImportMode` (in
[`src/features/profile-import/import/types.ts`](../../src/features/profile-import/import/types.ts):38)
becomes `'merge'`. Localized labels for `confirm.mode.add` /
`confirm.mode.merge` change accordingly. The amber duplicate
warning in
[`src/features/profile-import/ui/ConfirmDialog.tsx`](../../src/features/profile-import/ui/ConfirmDialog.tsx)
is removed; merge does not produce duplicates.

The import-pipeline code that currently performs the additive
write under `'add'` (in
[`src/features/profile-import/import/importProfile.ts`](../../src/features/profile-import/import/importProfile.ts))
is replaced by the field-merge path described above.

## Sub-entity behaviour: open-points bullets

Open-points have a parent (`context`) plus a list of bullets
(`text`). When two open-points match on `context`:

- Bullets that exist on only one side are kept.
- Bullets with byte-identical text on both sides are deduped.
- Bullets that differ only in punctuation/whitespace are still
  treated as distinct (no fuzzy match in v1; revisit later).
- Bullet ordering follows the existing entity, then appends
  parsed-only bullets.

## Test scope

- Unit (Vitest):
  - Natural-key match function per entity type (positive,
    negative, edge whitespace cases).
  - Conflict-detection function (identical-match suppresses
    conflict; differing-field surfaces conflict; per-field diff
    enumeration).
  - Field-merge resolution function (mine / theirs / per-field
    Mine-Theirs, all combinations).
  - Open-points bullet-merge (dedup, append, no fuzzy match).
- Integration (Vitest + fake-indexeddb):
  - End-to-end merge run against the `profile-a.md` /
    `profile-b.md` fixtures with disjoint themes -> resolution
    modal not surfaced, additive insert only.
  - End-to-end merge run with overlapping themes -> resolution
    modal surfaces, takes theirs / mine / per-field paths each
    produce the expected DB state.
  - Identical-import (same file twice) -> resolution modal not
    surfaced, no writes.
- E2E (Playwright):
  - Walk the new dialog flow under DE locale, verifying the
    resolution modal opens, focus traps, Escape returns, and the
    confirm path commits.
- Mutation (Stryker):
  - Add to the existing `import` mutation suite; per-module
    threshold rises if hardening lands cleanly.

## Open questions for Q-locks at implementation start

1. **Q1 - Should the conflict resolution be saved as a per-import
   summary** (e.g. "merged 12 entities, kept 3 from yours, took
   2 from import") on the synthesized `ProfileVersion`, or is the
   import marker enough?
2. **Q2 - Should the resolution modal default to "Keep mine"** for
   conflict-matches? Defaulting to "Take theirs" treats the
   import as the source of truth, which is the inverse of the
   user's intuition that imports are additive.
3. **Q3 - Open-points bullet match: punctuation/whitespace
   normalisation** - introduce now (less typing for the user) or
   defer (clearer semantics)?
4. **Q4 - Lab values inside a matched lab report**: when a lab
   report matches but contains different parameters, do the
   "missing on existing side" parameters merge in silently or
   surface as their own conflict row?
5. **Q5 - Migration impact on B-05 (Phase 6 follow-up)**: B-05
   "Merge-mode backup import" was deferred awaiting a clearer
   use case. Does IM-06's field-merge engine become the
   foundation B-05 needs, or do they remain independent?
6. **Q6 - Multi-conflict performance**: a profile with 100
   conflicting observations would produce a 100-row resolution
   modal. Acceptable, paginate, or auto-fall-back to a "take
   theirs / take mine" choice with no per-field option?
7. **Q7 - Localisation**: new section heading + per-conflict
   picker labels need DE/EN copy. Scoped under I18N-glossary
   when work starts.

## Trigger

Manual-smoke finding S4-S5-B in
[`docs/manual-smoke/im-05-option-b-merge.md`](../manual-smoke/im-05-option-b-merge.md),
2026-05-04 walk by Asterios Raptis.

## Acceptance

IM-06 is done when:

- The new merge mode replaces the old `'add'` semantic in code,
  tests, and locales.
- The resolution modal handles the three identified outcomes
  (new / identical / conflict) for every entity type.
- IM-05 manual-smoke scenarios 6-10 are walked against the new
  dialog and pass (or are explicitly retired as obsolete).
- Test coverage holds: import-module mutation threshold not
  regressed; new helpers covered to the same standard as the
  existing parser code.
- IM-06 entry in ROADMAP "Phase 4 follow-up: Import" is moved to
  the closed list with the shipping commit hash.
