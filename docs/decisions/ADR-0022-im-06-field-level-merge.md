# ADR-0022: IM-06 field-level merge mode

**Date:** 2026-05-04
**Status:** Accepted (implementation complete; smoke verification pending)

## Context

The IM-05 Option B import dialog shipped three per-type modes -
`replace`, `add`, `skip` - on 2026-05-01. The 2026-05-04 manual smoke
walk
([`docs/manual-smoke/im-05-option-b-merge.md`](../manual-smoke/im-05-option-b-merge.md))
established that none of those modes matched the user's mental
model of "merging two profiles":

- `replace` destroys existing data; only acceptable for explicit
  overwrites.
- `add` creates duplicate rows for every entity that exists on both
  sides (same theme on observations, same `reportDate` on lab
  reports, same `name|brand` on supplements, same `context|text` on
  open-points). The dialog's amber "duplicates may occur" warning
  was honest about this but did not fix the underlying UX.
- `skip` discards the import for that section entirely.

The user had no path to import the new bits of a second profile
without either destroying their existing data or accepting
duplicates of overlapping entries.

IM-06 introduces a real field-level merge engine that matches by
natural key per entity type, inserts non-matching rows, and routes
field-level conflicts through a per-conflict resolution UX. The
implementation spans eight commits on the
`feat/im-06-field-level-merge` branch (Steps 1 through 7 + Step 8
close-out), with explicit per-step diff review per the project's
`.claude/rules/ai-workflow.md` discipline.

This ADR records the architectural decisions taken across that
series. Implementation detail lives in
[`docs/specs/IM-06-field-level-merge.md`](../specs/IM-06-field-level-merge.md);
this document captures the architectural reasoning trail.

## Decision

### 1. Pure-domain extraction in `src/domain/import-merge/`

Match logic lives entirely in the domain layer:

- `naturalKey.ts`: per-type extractors. Trim semantics, composite
  keys for supplements (`name|brand`), open-points
  (`context|text`), and timeline entries (`period|title`).
- `matchEntities.ts`: bucketing into `new` / `identical` /
  `conflict` outcomes. Bookkeeping fields (`id`, `profileId`,
  `createdAt`, `updatedAt`, `reportId`, `reportIndex`) excluded
  from diff computation. `valuesEqual` deep-compare for
  primitives + arrays + plain objects with sorted-key
  serialization for stable map content (extraSections /
  categoryAssessments).
- `resolveMerge.ts`: pure transform from `MergeMatch[]` plus user
  resolutions to a per-type `MergePlan` (inserts + updates).

No React, no Dexie, no encryption inside the domain layer. The
storage layer (`importProfile.ts`) calls these helpers, then
serializes the resulting plan into encrypted rows for `bulkPut`.

Reusability is the explicit secondary goal. B-05 (Phase 6
follow-up: merge-mode backup import, currently deferred per
ROADMAP) needs the same natural-key + match-entities engine.
Keeping it in `domain/` rather than `features/profile-import/`
means B-05 can import without circular dependencies.

### 2. No-deletes invariant on the merge path

Field-level merge NEVER produces a delete. `MergePlan<K>` has
`inserts: T[]` + `updates: EntityUpdate<K>[]` and no
`deletes`. The storage layer's `'merge'` branch in
`applyMode` calls `bulkPut(table, mergeRows)` only - existing
rows whose ids do not appear in the slice stay untouched
because `matchEntities` only emits matches for parsed inputs;
existing-only rows are absent from both arrays.

This guarantee is testable:
[`importProfile.merge.test.ts`](../../src/features/profile-import/import/importProfile.merge.test.ts)
asserts the absent-entity-preservation case explicitly
("merge with disjoint themes appends without touching existing
rows"). The invariant is also propagated as a documentation
contract in `prepareMergeRows` and `prepareLabDataMergeRows`.

The `'replace'` branch retains its destructive semantic by
contrast: `'merge'` is the safe alternative for users who want
"add the new bits without losing what's there".

### 3. FK-rewiring strategy for lab data

LabReport + LabValue are matched together with FK consistency
preserved across all four parent/child cases:

| Parent outcome   | Children                                   |
| ---------------- | ------------------------------------------ |
| `new`            | Children take the parsed report's fresh id |
| `identical`      | Children bind to the existing parent's id  |
| `conflict`       | Same as identical (FK preserved on update) |
| absent in parsed | Existing children stay untouched           |

The `effectiveReportIds[]` array bridges the up-front
`labReportIds[]` (every parsed report gets a fresh id) and the
matched-existing-parent ids. Children consult
`effectiveReportIds[parsed.reportIndex]`, so a parsed value's
`reportId` always points at the correct persisted parent row id
at write time - either fresh-and-fresh (case 1), or
matched-existing-id (cases 2 + 3).

Q4 silent additive merge (parsed value with a parameter not in
the matched parent's existing value set) buckets as `'new'` from
`matchLabValuesPerReport` and inserts without consulting the
resolution map. The user is not asked to confirm "should I add
this new lab parameter to your existing report?" - additive is
unambiguous.

W6 cross-report independence: lab-value matching is scoped per
parent. Two parameters with the same name under different parent
reports never collide.

### 4. Pre-transaction atomicity discipline

All non-Dexie async work happens BEFORE `db.transaction(...)`
opens:

- `detectMergeConflicts` runs the matchers in dry-run mode to
  decide whether the state machine routes through
  `'conflict-resolution'` or jumps straight to `'importing'`.
- `prepareMergeRows` / `prepareLabDataMergeRows` run the matchers
  - resolveMerge + serialization for real, producing
    encrypted-row arrays ready for `bulkPut`.
- `UnresolvedConflictError` (thrown when the user's resolution
  map is incomplete) propagates BEFORE the transaction opens.

The Dexie transaction body contains only `bulkPut` /
`deleteByProfileId` calls - no `await` on a non-Dexie promise,
no decryption, no application logic. This satisfies Dexie's
"transaction aborts on non-Dexie await" rule and means the
vault stays untouched on any pre-transaction error (decryption
failure, missing resolution, type-system violation).

### 5. Three-mode UI vs four-mode storage API

The `ImportMode` type is `'replace' | 'add' | 'merge' | 'skip'`.
The UI surfaces only `replace / merge / skip`. The `'add'` mode
is retained at the storage-layer API for backwards compatibility
with IM-05 Option B callers but no longer exposed in the
`ConfirmDialog`.

Reasoning:

- The smoke-walk evidence established that `'add'` (additive
  coexistence with duplicates) violated the user's mental model.
  Removing it from the UI is a UX correction, not just a
  rename.
- Programmatic API consumers (test fixtures, future automation,
  power-user edge cases like deliberate duplicate generation)
  should not lose access to the underlying semantic.
- 38 storage-layer tests in `importProfile.test.ts` (9 of them
  explicitly `'add'`-mode) continue to pass, confirming the
  back-compat invariant.

The `mode.add` locale key is renamed to `mode.merge` (DE label
`Zusammenführen` was already correct; EN label changed from
`Merge` (which still meant `add` semantically) to `Merge`
(which now means field-level merge)).

### 6. ConflictResolution union mirrors local UI state

The `ConflictResolution<K>` type from the domain layer:

```ts
| { kind: 'mine' }
| { kind: 'theirs' }
| { kind: 'field-by-field';
    fieldChoices: Partial<Record<keyof T & string, 'mine' | 'theirs'>> }
```

is mirrored exactly as the UI dialog's working `ConflictPick`
state. `pickToResolution(pick)` is a pass-through. This avoids
schema duplication: the resolveMerge contract is also the UI
contract.

Q2 discipline (no default radio preselection; Confirm disabled
until every conflict has an explicit pick) is enforced at three
layers:

1. UI: `isPickResolved(pick, diffCount)` gates the Confirm
   button.
2. Resolver: `UnresolvedConflictError` thrown when a `'conflict'`
   match has no resolution entry, or when a `field-by-field`
   resolution leaves a diff field without a pick.
3. State machine: `submitResolutions` propagates the error to
   `'error'` state if the UI bypassed its gate.

### 7. State machine extension over rewrite

`useImport`'s state machine added one new arm
(`'conflict-resolution'`) plus one new method
(`submitResolutions`). The existing arms (`entry`, `parsing`,
`profile-selection`, `parse-failure`, `preview`,
`confirm-replace`, `importing`, `done`, `error`) and methods
(`loadMarkdown`, `selectProfile`, `confirmReplace`,
`startImport`, `requestAICleanup`, `proceedWithPartial`,
`cancel`, `reset`) are unchanged. A 60-line state-graph
block-comment documents the full transition map.

Atomicity guarantees published in the comment:

- Pre-transaction conflict detection routes errors to `'error'`,
  not `'conflict-resolution'`. Only user-decision conflicts
  surface as `'conflict-resolution'` (W4).
- Cancel from `'conflict-resolution'` returns to `'entry'`. No
  transaction was opened; vault unchanged (W3).
- `submitResolutions` outside `'conflict-resolution'` is a no-op
  (defensive; flagged as IM-06-polish-2 if it causes confusion).

### 8. Smoke-driven correction as architectural feedback

The IM-05 → IM-06 transition is a precedent for "smoke walks
surface architectural gaps that automated tests cannot". The
P-22 polish-1 / polish-2 history preservation pattern is
extended here: the IM-05 Option B smoke file is kept as a
historical artifact under a `SUPERSEDED BY IM-06` banner (no
content removed) so the decision trail stays legible.

This pattern - smoke as architectural-correction tool, not just
visual-fit verification - is worth carrying forward to future
multi-day tracks. Lessons-learned section below summarises.

## Consequences

Positive:

- Users can merge two profiles without destroying or
  duplicating existing data. The user's mental model of
  "merge" finally matches the implementation.
- The domain layer's match + resolve helpers are reusable for
  B-05. Phase 6 follow-up unblocks.
- Three-mode UI is more intuitive than the IM-05 four-mode
  experiment (replace / add / merge / skip would have been
  confusing).
- Atomicity guarantees are explicit, tested, and enforced at
  three layers (UI gate, resolver assertion, state-machine
  error route).

Negative / accepted trade-offs:

- W1 byte-equal limitation: surface variants of the same logical
  entity (whitespace, punctuation, capitalisation differences)
  match-fail and stay as `new`. Future Q3 normalisation work
  addresses if user feedback flags it.
- Mode-switch from `field-by-field` to `mine` / `theirs`
  discards per-field picks. Cleaner state but trades user
  effort if the same picks need to be re-entered. IM-06-polish-4
  marker tracks this for smoke verification.
- Synth-marker accumulation: every merge import adds one
  "Profil aus Datei importiert" `ProfileVersion` row.
  By-design audit trail; IM-06-polish-1 tracks dedup if
  cluttered.
- Storage-layer `'add'` retained for back-compat. New code paths
  should pick `'merge'`; the project does not enforce the API
  surface beyond the UI layer.

## Lessons-learned: smoke as architectural-correction tool

The IM-05 → IM-06 trajectory illustrates a feedback loop:

1. Implement to plan (IM-05 Option B, 2026-05-01).
2. Walk smoke with real-user mental model (2026-05-04).
3. Surface architectural gap (replace destroys, add duplicates -
   neither matches user intuition).
4. Spec the correction (IM-06 spec on the same day).
5. Re-implement against the corrected model.
6. Walk new smoke (Step 7 deliverable; pending).

Steps 2 and 3 - the "smoke as architectural-correction tool"
phase - were missing from the IM-05 release process. Tier 1
automated tests covered the IM-05 Option B implementation
correctly; the gap was the user-mental-model layer that only
manual walk-through can surface.

Going forward: any feature that ships per-type or per-row UX
decisions (import / export / backup / merge) should plan for
a smoke walk before tagging the feature as done. Walk-only
findings can rewrite scope; that is a feature of the process,
not a defect.

## Related decisions

- **ADR-0001** AES-GCM-256 + PBKDF2 (crypto baseline; not
  affected by IM-06)
- **ADR-0017** PDF.js for PDF import (parser decision; the
  IM-06 engine matches against parser output)
- **ADR-0018** Master-password change reencryption (P-06; the
  IM-06 smoke includes a P-06 cross-feature scenario)
- **ADR-0019** Multi-AI-provider (parallel pattern of
  domain-layer extraction; IM-06 follows the precedent)

## Implementation trail

Branch: `feat/im-06-field-level-merge`. Eight commits with
explicit per-step diff review:

| Step | Commit  | Scope                                              |
| ---- | ------- | -------------------------------------------------- |
| 1    | af30915 | Domain layer (types + naturalKey + matchEntities)  |
| 2    | f975e7a | resolveMerge transform + tests                     |
| 3a   | 5dfc191 | Wire `'merge'` for simple-table types in storage   |
| 3b   | d4c8e95 | Lab-data `'merge'` with FK rewiring                |
| 4    | f92b17e | useImport state machine + `'conflict-resolution'`  |
| 5a   | 01cc5ca | ConflictResolutionDialog mine/theirs + integration |
| 5b   | 771aab0 | Field-by-field expansion + per-field rendering     |
| 6    | 55feed6 | ConfirmDialog `'add'` -> `'merge'` UI swap         |
| 7    | 29897ec | IM-06 smoke walk file + IM-05 supersede banner     |
| 8    | (this)  | ROADMAP closure prep + ADR-0022 + branch close-out |

Test count on branch: 382 passing (Steps 1-6 contribute the
new tests; Step 7 is doc-only).

## Branch close-out

Merge strategy: **merge-commit** (not squash, not fast-forward).
Preserves the eight-step branch history so future maintainers
can read the per-step diff/decision trail via
`git log --first-parent` or by following the merge commit's
parents. Single merge commit on `main` marks a clean closure
boundary for the IM-06 feature. The merge commit message
should reference this ADR.

After the user-led smoke walk in
[`docs/manual-smoke/im-06-field-level-merge.md`](../manual-smoke/im-06-field-level-merge.md)
passes:

1. Merge `feat/im-06-field-level-merge` to `main` via
   merge-commit.
2. Tick the IM-06 entry in `docs/ROADMAP.md`.
3. Update spec status to `Shipped {merge-commit-hash}`.
4. Walk any remaining smoke scenarios that needed the merged
   build to verify (e.g. cross-feature P-06 scenario).
