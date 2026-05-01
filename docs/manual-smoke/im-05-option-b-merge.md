# IM-05 Option B merge-add manual smoke

Three-mode per-type import dialog (replace / add / skip), shipped
as the user-reported follow-up to the original IM-05 selective-replace
release. Vitest covers the per-mode write decisions (38 import tests
including 9 Option B specifics) and the dialog state machine (no
default mode, confirm-disabled gating, add-warning visibility,
empty-side disabled radios). This smoke covers what automation
cannot: real-browser focus management, dark-mode contrast, 360 px
fit with up to six type rows, and the user-perception layer where
Add-mode actually creates additive duplicates of the prior import.

## Setup

1. **Browser**: Chrome with DevTools.
2. **Fixture**: authenticated session with one profile that contains
   a mix of entities to make the dialog show several rows. Suggested
   seed (manually create or import a baseline profile):
   - 2 observations
   - 1 lab report with 3 lab values
   - 2 supplements
   - 1 open point
3. **Source files**: two markdown profiles, "Profile A" already
   imported into the target, "Profile B" prepared in `/tmp` as a
   second import. Both should contain entities of all visible types
   so the dialog renders the full set of rows.
4. **Theme matrix**: scenarios 1-3 in light, scenario 7 in dark.

## Scenarios

### 1. Dialog opens with no default mode; confirm disabled

- **Steps**: Navigate to `/import`. Paste / select Profile B's
  markdown. Pick the existing target profile that already holds
  Profile A's data. Observe the dialog.
- **Expected**:
  - Heading reads "Import in bestehendes Profil" (DE) /
    "Import into existing profile" (EN).
  - Helper text below the heading explains the three modes.
  - One row per type with non-zero existing OR parsed counts.
  - Each row shows three radios: Ersetzen / Zusammenführen /
    Überspringen (none preselected).
  - "Übernehmen" button is disabled.
  - Cancel button is focused on mount.
- **Result**: ☐ pass ☐ fail

### 2. Confirm enables only after every visible row has a mode

- **Steps**: Pick a mode for one row. Observe button. Pick modes
  for the remaining rows one by one.
- **Expected**:
  - Button stays disabled while any row has no mode picked.
  - Button enables on the click that selects the last missing
    mode.
  - Picking + re-picking on the same row never disables the
    button (each row keeps a mode once picked).
- **Result**: ☐ pass ☐ fail

### 3. Add-mode warning surfaces and toggles with selection

- **Steps**: Set every row to Ersetzen. Then change one row to
  Zusammenführen. Then change that row back to Ersetzen.
- **Expected**:
  - No warning visible while every row is Ersetzen / Überspringen.
  - Amber warning surfaces once any row is Zusammenführen.
  - Warning hides again as soon as no row is on Add.
  - Warning copy mentions duplicates if the same file is imported
    multiple times.
- **Result**: ☐ pass ☐ fail

### 4. All-Replace produces the legacy overwrite behaviour

- **Steps**: With Profile A in the target, open the dialog for
  Profile B. Set every row to Ersetzen. Confirm.
- **Expected**:
  - Result screen reports the imported counts.
  - Navigate to `/observations`, `/lab-values`, `/supplements`,
    `/open-points`: only Profile B's data is present (A wiped).
  - Profile version history retains the synthesized "Profil aus
    Datei importiert" entry.
- **Result**: ☐ pass ☐ fail

### 5. All-Merge produces additive coexistence (the smoke goal)

- **Steps**: Reset target back to Profile A only. Open the dialog
  for Profile B. Set every row to Zusammenführen. Confirm.
- **Expected**:
  - Result screen reports Profile B's imported counts.
  - Navigate to each entity view: BOTH Profile A's and Profile
    B's entities are visible. Observation count = A + B,
    supplement count = A + B, lab reports = A + B, etc.
  - Profile version history includes both A's and B's parsed
    versions plus the synthesized import marker.
- **Result**: ☐ pass ☐ fail

### 6. Mixed mode (Add + Replace + Skip) honours per-type pick

- **Steps**: Reset target to Profile A. Open Profile B import.
  Set:
  - Observations → Zusammenführen
  - Supplements → Ersetzen
  - Open-points → Überspringen
  - Other rows → free choice (will be wiped, replaced, etc.)
    Confirm.
- **Expected**:
  - Observations view: A's + B's observations coexist.
  - Supplements view: only B's supplements (A's wiped).
  - Open-points view: only A's open-points (B's discarded).
- **Result**: ☐ pass ☐ fail

### 7. Empty-side disabled radios

- **Steps**: Construct a target where one type is empty (e.g.
  delete all open-points from Profile A). Import a Profile B that
  has open-points. Open the dialog.
- **Expected**:
  - Open-points row shows Ersetzen disabled (nothing to replace),
    Zusammenführen + Überspringen enabled.
  - Inverse case: target has open-points, Profile B does not.
    Ersetzen + Überspringen enabled, Zusammenführen disabled
    (nothing to add).
- **Result**: ☐ pass ☐ fail

### 8. Same file imported twice with all-Add creates duplicates

- **Steps**: With a fresh single-profile vault, import Profile A
  with replaceExisting=true (legacy path; or all-Replace through
  the new dialog if a non-empty target was first seeded). Then
  import the SAME Profile A markdown again with all-Zusammenführen.
- **Expected**:
  - Every entity now exists twice with different IDs.
  - The amber duplicate warning was visible in the dialog before
    confirming.
  - User experience matches the duplicate hint copy.
- **Result**: ☐ pass ☐ fail

### 9. Dark mode legibility

- **Steps**: Toggle theme to dark. Walk scenarios 1 and 5.
- **Expected**:
  - Radio buttons stay legible against the modal background.
  - Amber duplicate warning has visible contrast in dark.
  - Disabled radios visually distinct from enabled ones.
- **Result**: ☐ pass ☐ fail

### 10. 360 px viewport fit

- **Steps**: DevTools Device Mode at 360 px. Open the dialog with
  a target + parsed source where all six type rows render.
- **Expected**:
  - Dialog clamps to viewport via `max-w-md`.
  - Per-row radios stay on one line when text fits or wrap onto a
    second line cleanly when long.
  - No horizontal scroll inside the dialog.
  - Cancel + Übernehmen footer buttons fit side by side.
- **Result**: ☐ pass ☐ fail

## Findings

(none yet)

## Sign-off

- ☐ Dialog opens with no default mode; confirm disabled (scenario 1)
- ☐ Confirm enables only after every visible row has a mode (scenario 2)
- ☐ Add-mode warning surfaces and toggles correctly (scenario 3)
- ☐ All-Replace produces overwrite (scenario 4)
- ☐ All-Merge produces additive coexistence (scenario 5)
- ☐ Mixed mode honours per-type pick (scenario 6)
- ☐ Empty-side disabled radios behave correctly (scenario 7)
- ☐ Same file twice with all-Add creates duplicates (scenario 8)
- ☐ Dark mode legible (scenario 9)
- ☐ 360 px fit (scenario 10)

Walker: ********\_\_\_\_********
Date: 2026-**-**
