# IM-06 Field-level merge manual smoke

Field-level merge mode (IM-06) replacing the IM-05 Option B Add
semantic. Pre-transaction natural-key matching, conflict-resolution
dialog with mine / theirs / field-by-field picks, atomic write inside
a single Dexie transaction.

References:

- Spec: [`docs/specs/IM-06-field-level-merge.md`](../specs/IM-06-field-level-merge.md)
- Branch: `feat/im-06-field-level-merge`
- ROADMAP entry: `Phase 4 follow-up: Import` (IM-06)
- Predecessor: [`docs/manual-smoke/im-05-option-b-merge.md`](im-05-option-b-merge.md)
  (superseded; kept as historical artifact for the decision trail)
- Polish-markers tracked alongside IM-06 in ROADMAP (verified or
  resolved during this walk where noted):
  - **IM-06-polish-1** Synth-marker dedup (scenario 16 verifies; not
    blocking)
  - **IM-06-polish-2** `submitResolutions` silent no-op (state-machine
    discipline; smoke does not exercise the UI-bug path)
  - **IM-06-polish-3** value-preview in mine/theirs (likely resolved
    by field-by-field design; scenario 4-5 should confirm whether
    blind picks feel acceptable)
  - **IM-06-polish-4** preserve field-picks across mode-switch
    (scenario 10 currently verifies the W1 lean of discarding;
    revisit if walker reports frustration)

## Setup

1. **Browser**: Chrome with DevTools.
2. **Fixtures**: copy from
   [`test-data/profile-a.md`](test-data/profile-a.md) and
   [`test-data/profile-b.md`](test-data/profile-b.md). Profile A
   loads first; Profile B is the merge source. Both are kept disjoint
   on most natural keys so individual scenarios can construct
   conflicts deliberately.
3. **Seed script**: optional helper to wipe state, onboard, import
   Profile A, and pause at the confirm-replace dialog with merge
   pre-selected. Run via:
   ```bash
   make seed-smoke SCENARIO=profile-a-plus-b
   ```
4. **Fixture overrides**: scenarios that need a specific conflict
   construction modify Profile B inline before pasting (note in the
   scenario steps). Reset between scenarios via Settings → Daten
   zurücksetzen.

## Scenarios

### 1. Disjoint profiles merge produces pure inserts, no conflicts

- **Steps**: load Profile A. Import Profile B (no overlapping themes,
  reportDates, supplement names, contexts). Pick `Zusammenführen`
  for every type in the ConfirmDialog. Click Übernehmen.
- **Expected**:
  - ConflictResolutionDialog never opens.
  - Result screen shows successful import.
  - `/observations`, `/lab-values`, `/supplements`, `/open-points`
    each show A's + B's entries without modification.
- **Result**: ☑ pass (with finding S1-A; see Findings)

### 2. Identical entries collapse to no-op

- **Steps**: load Profile A. Re-import the SAME Profile A. Pick
  `Zusammenführen` for every type. Click Übernehmen.
- **Expected**:
  - ConflictResolutionDialog never opens (matches all bucket as
    `identical`).
  - Result screen shows successful import.
  - Entity counts unchanged.
- **Result**: ☐ pass ☐ fail

### 3. New parameter in matched lab report = silent additive merge (Q4)

- **Steps**: load Profile A. Edit Profile B so its lab report
  shares the `reportDate` (e.g. `2026-04-15`) with one of A's
  reports, but contains one parameter not present in A. Import.
  Pick `Zusammenführen` for `labData`.
- **Expected**:
  - ConflictResolutionDialog never opens (parent report is
    identical or only has additive children).
  - `/lab-values` shows the new parameter under the existing
    parent report.
  - Existing values in the matched report are unchanged.
- **Result**: ☐ pass ☐ fail

### 4. Single conflict resolution = mine preserves existing

- **Steps**: load Profile A. Edit Profile B so one observation
  shares a theme with A but with different `fact` text. Import.
  Pick `Zusammenführen` for observations. Confirm.
  ConflictResolutionDialog opens with one conflict. Pick
  `Vorhandene behalten`. Click Übernehmen.
- **Expected**:
  - Existing observation preserved (fact unchanged).
  - No duplicate row.
  - Result screen shows successful import.
- **Result**: ☐ pass ☐ fail

### 5. Single conflict resolution = theirs overwrites the field

- **Steps**: same setup as scenario 4. This time pick
  `Importierte übernehmen`. Click Übernehmen.
- **Expected**:
  - Existing observation row id unchanged (updated, not
    inserted).
  - `fact` reflects Profile B's value.
  - Other fields on the observation untouched.
- **Result**: ☐ pass ☐ fail

### 6. Field-by-field resolution: per-field choices land

- **Steps**: load Profile A. Edit Profile B so one observation
  shares a theme with A and differs on three fields (e.g. `fact`,
  `pattern`, `selfRegulation`). Import. Pick `Zusammenführen`.
  In ConflictResolutionDialog: pick `Feldweise entscheiden` on
  the conflict. Pick `Vorhandene behalten` for one field,
  `Importierte übernehmen` for the other two. Click Übernehmen.
- **Expected**:
  - The mine-picked field keeps A's value.
  - The two theirs-picked fields take B's values.
  - Row id unchanged (updated, not inserted).
- **Result**: ☐ pass ☐ fail

### 7. Multi-type conflicts surface in sectioned dialog

- **Steps**: load Profile A. Edit Profile B so observations,
  lab-values, and supplements each have at least one conflict.
  Import. Pick `Zusammenführen` for every affected type.
- **Expected**:
  - Dialog opens.
  - One section per affected type (Beobachtungen, Laborwerte,
    Verträglichkeiten) with the conflict count badge.
  - First section expanded by default; the rest collapsed.
  - Toggle each section open and verify the conflict rows
    render the natural-key identity label and diff-fields list.
- **Result**: ☐ pass ☐ fail

### 8. Q2 gating: Confirm disabled until every conflict picked

- **Steps**: from scenario 7 with multiple conflicts open.
  Observe the Übernehmen button.
- **Expected**:
  - Disabled on dialog open.
  - Stays disabled while any conflict has no pick.
  - Enables on the click that picks the last missing mode.
  - Progress counter (`{resolved} von {total} Konflikten gelöst`)
    updates live.
- **Result**: ☐ pass ☐ fail

### 9. Per-field gating: field-by-field requires every diff picked

- **Steps**: from scenario 6 with one conflict on three fields.
  Pick `Feldweise entscheiden`. Pick choices for two of three
  fields.
- **Expected**:
  - Confirm button stays disabled (third field still missing).
  - Picking the third field enables Confirm.
- **Result**: ☐ pass ☐ fail

### 10. Mode-switch discards per-field picks (W1 lean)

- **Steps**: from scenario 6. Pick `Feldweise entscheiden`. Set
  picks on two fields. Switch to `Vorhandene behalten`, then
  switch back to `Feldweise entscheiden`.
- **Expected**:
  - Per-field panel re-opens with all radios empty (no picks
    preserved across mode-switch).
- **Result**: ☐ pass ☐ fail

### 11. ESC during conflict-resolution = full cancel; vault unchanged

- **Steps**: from scenario 7 with conflicts. Press ESC.
- **Expected**:
  - Dialog closes.
  - User returns to entry screen (state machine: `entry`).
  - Walk to `/observations`, `/lab-values`, `/supplements`,
    `/open-points`: counts and contents identical to before the
    import attempt.
- **Result**: ☐ pass ☐ fail

### 12. Cancel button during conflict-resolution behaves identically to ESC

- **Steps**: same as scenario 11; click `Abbrechen` instead of
  pressing ESC.
- **Expected**: identical behaviour.
- **Result**: ☐ pass ☐ fail

### 13. Long values: truncate with "Mehr anzeigen" toggle

- **Steps**: load Profile A. Edit Profile B so one observation
  shares a theme with A and the differing `fact` field is
  > 100 characters on one side. Import. Pick `Zusammenführen` →
  > `Feldweise entscheiden` on the conflict.
- **Expected**:
  - Per-field expansion shows mine + theirs side by side.
  - Long string truncates at 80 chars with `…` suffix.
  - "Mehr anzeigen" toggle below the value.
  - Click toggle: full string visible.
  - Click again: collapses to truncated.
- **Result**: ☐ pass ☐ fail

### 14. Edge value rendering: empty / undefined / boolean

- **Steps**: construct a conflict on a field where one side is
  empty string, undefined, or boolean (e.g.
  `OpenPoint.resolved: true` vs `false`). The fixture format
  doesn't expose all of these directly; this scenario is
  primarily a visual sanity check.
- **Expected**:
  - Empty / undefined / null render as `—`.
  - Boolean renders as `✓` (true) / `✗` (false).
  - Other types render via `JSON.stringify`.
- **Result**: ☐ pass ☐ fail

### 15. Composite-key matching: open-points (context+text) + supplements (name+brand)

- **Steps**:
  - Edit Profile B so an open-point matches A on `context` but
    has different `text` (composite key differs → both kept,
    no conflict).
  - Edit Profile B so a supplement matches A on `name` but with
    a different `brand` (composite key differs → both kept).
  - Import with merge mode.
- **Expected**:
  - No conflicts on either type (composite-key mismatch produces
    `new` outcomes).
  - Both A's and B's entries coexist after import.
- **Result**: ☐ pass ☐ fail

### 16. Synthesized profile-version marker writes after merge (Q5)

- **Steps**: load Profile A. Import Profile B (any merge scenario).
  After successful import, navigate to the profile-version history
  view (Settings or profile detail).
- **Expected**:
  - One new entry with `changeDescription = "Profil aus Datei
importiert"` and a bumped version label.
  - The synthesized marker writes regardless of whether
    profile-versions had conflicts (Q5 invariant).
  - **IM-06-polish-1 verification**: re-run the same merge a
    second time. Note whether two synth markers accumulate. If
    the user finds this cluttered, the polish marker becomes
    actionable. By design v1, audit-trail behaviour.
- **Result**: ☐ pass ☐ fail

### 17. Master-password change after merge preserves merged data (P-06)

- **Steps**: complete a successful merge import. Navigate to
  Settings → Master-Passwort ändern. Change password. Re-unlock
  with the new password.
- **Expected**:
  - All merged entries (originals from A + new from B + updated
    from conflicts) decrypt correctly under the new password.
  - No data loss.
- **Result**: ☐ pass ☐ fail

### 18. Light + dark mode parity

- **Steps**: walk scenarios 4 + 7 + 13 in dark mode (toggle theme).
- **Expected**:
  - ConflictResolutionDialog body legible.
  - Section toggle, radio buttons, value cells all keep
    sufficient contrast.
  - Truncated value `<pre>` blocks render against the dark
    background without bleed.
- **Result**: ☐ pass ☐ fail

### 19. 360 px viewport fit

- **Steps**: DevTools Device Mode at 360 px. Walk scenarios
  4 + 7 + 13 at this viewport.
- **Expected**:
  - Dialog clamps to viewport (`size="lg"` capped).
  - Section toggles + count badges fit in the row.
  - Per-conflict radios wrap onto a second line cleanly when
    needed.
  - Field-by-field expansion's mine/theirs grid stacks to one
    column instead of two (`sm:grid-cols-2`).
  - No horizontal scroll inside the dialog.
- **Result**: ☐ pass ☐ fail

### 20. Scaling: 30+ conflicts render without UX degradation (W6)

- **Steps**: construct a Profile B with 30+ conflicting rows
  across multiple types (e.g. 20 observations + 10 supplement
  entries each conflicting with A). Import.
- **Expected**:
  - Dialog opens within a couple of seconds.
  - Sections collapse smoothly.
  - Scroll inside the dialog body works (no whole-page jump).
  - Progress counter updates live as picks are made.
  - No perceptible lag picking individual radios.
  - Confirm gates correctly across all conflicts.
- **Result**: ☐ pass ☐ fail

## Findings

### S1-A (Category A UX gap, scenario 1, fixed in same session)

ConfirmDialog rendered rows for every entity type where
EITHER existing OR parsed had non-zero count. Consequence: a
profile with existing observations + an import whose
`observations` was empty forced the user into the row's mode
picker. The only safe pick was `Überspringen`; `Ersetzen`
would have destroyed the existing observations the import did
not touch, and `Zusammenführen` was disabled (nothing to merge
in). Same destructive-option-exposure shape as the original
IM-05 finding.

**Fix shipped** the same day on the IM-06 branch:
`rowsFromCounts` filter now requires `parsed > 0` (or
`secondaryParsed > 0` for lab data). Zero-parsed rows are
hidden; resolver's missing-key default (`'skip'`) preserves
existing data implicitly. Documented in ADR-0022 decision 9.
New `ConfirmDialog.test.tsx` test "row hidden entirely when
parsed is zero" guards the regression.

## Sign-off

- ☑ Disjoint profiles merge (scenario 1) — pass with S1-A fixed in-session
- ☐ Identical entries collapse (scenario 2)
- ☐ New parameter silent additive (scenario 3)
- ☐ Mine wins (scenario 4)
- ☐ Theirs wins (scenario 5)
- ☐ Field-by-field per-field choices (scenario 6)
- ☐ Multi-type conflicts in dialog (scenario 7)
- ☐ Q2 gating (scenario 8)
- ☐ Per-field gating (scenario 9)
- ☐ Mode-switch discards per-field picks (scenario 10)
- ☐ ESC = full cancel (scenario 11)
- ☐ Cancel button = full cancel (scenario 12)
- ☐ Long values truncate + expand (scenario 13)
- ☐ Edge value rendering (scenario 14)
- ☐ Composite-key matching (scenario 15)
- ☐ Synth-marker writes after merge (scenario 16)
- ☐ P-06 reencryption preserves merged data (scenario 17)
- ☐ Light + dark mode parity (scenario 18)
- ☐ 360 px viewport fit (scenario 19)
- ☐ 30+ conflicts scaling (scenario 20)

Walker: **\*\*\*\***\_\_\_\_**\*\*\*\***
Date: 2026-**-**
