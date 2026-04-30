# P-01 Mobile-first sweep manual smoke

Tier 2 of the P-01 audit shipped 2026-04-30 in
`docs/audits/2026-04-30-mobile-sweep.md`. Tier 1 automated checks
passed 6/6 across 39 (route × viewport) combinations and zero
Category A or B structural findings. This file is the human eye-check
that catches what `scrollWidth ≤ viewport + 1` and "non-zero bounding
box" cannot: cramped spacing, ugly wrap, hit-target ergonomics,
sticky-bar overlap, modal overflow under content-heavy fixtures.

## Setup

1. **Browser**: Chrome with DevTools Device Mode (Cmd / F12 → toggle
   device toolbar).
2. **Sequence per viewport**: 360 → 768 → 1024.
3. **Theme matrix**: repeat the 360-px walk-through in dark mode (P-02
   already verified dark per screen, but theme-aware spacing breakage
   at the responsive floor is the orthogonal-axis edge case worth
   checking).
4. **Fixtures**: walk an authenticated session with at least one
   profile populated by an `IM-04` import (existing fixtures cover
   observations, lab data, supplements, open points, timeline,
   profile versions).
5. **Screenshot anything ambiguous** - Category C polish findings
   benefit from a snapshot for later review.

## Viewports

| Viewport | Use case |
| -------- | -------- |
| 360 px   | Mobile floor (older Android phones; CLAUDE.md mobile-first floor) |
| 768 px   | Tablet portrait, iPad mini, Tailwind `md` threshold |
| 1024 px  | Tablet landscape / small desktop, Tailwind `lg` threshold |

## Scenarios

Numbered scenarios per area. Each is a yes/no eye-check; "no" answers
become findings in the next section.

### 1. Authenticated shell at 360 px

- **Steps**: open `/profile` after `setupAuthenticatedSession`. Tap
  the hamburger button (top-left, `md:hidden`). Tap a nav item to
  navigate. Reopen drawer; close via X, backdrop, Escape.
- **Expected**:
  - Hamburger reachable with one thumb tap, button is ≥ 44 × 44 px.
  - Header search-toggle (right) reachable; theme + lock buttons
    do not overflow the strip.
  - NavDrawer slides in fully visible (`max-w-[80vw] = 288 px`).
  - Focus trap holds; backdrop / X / Escape all close.
- **Result**: ☐ pass ☐ fail

### 2. Profile overview at 360 px

- **Steps**: `/profile`. Scroll through BaseDataSection, doctor,
  diagnoses, medications, limitations, warnings, refs, context.
- **Expected**:
  - Labels and values do not horizontally clip.
  - Lists wrap, do not scroll inside their card.
  - External references render compactly.
  - Long context-notes paragraph wraps cleanly.
- **Result**: ☐ pass ☐ fail

### 3. Entity views at 360 px

- **Steps**: `/observations`, `/lab-values`, `/supplements`,
  `/open-points`, `/timeline`. Open match-nav at `/observations`,
  scroll the lab-values table, expand a few cards.
- **Expected**:
  - Observation card header (theme + chevron) does not collapse.
  - Sticky search bar does not cover content underneath.
  - Lab-values table scrolls horizontally inside its
    `overflow-x-auto` wrapper without leaking the page scrollbar.
  - Lab report meta block (date, lab, source) wraps before clipping.
  - Supplement category cards stack one-per-row.
  - Open-points priority + horizon badges fit alongside the title or
    wrap below.
  - Timeline markdown bodies render inside the card.
- **Result**: ☐ pass ☐ fail

### 4. Forms at 360 px

- **Steps**: `/profile/create`. Fill the form. Edit BaseData via
  `O-19` form. Toggle password visibility on `/setup` if walking
  onboarding.
- **Expected**:
  - Form labels + inputs both fit at 360 px.
  - Long input rows (date, name) do not overflow.
  - Password fields show eye-toggle without crowding the label.
- **Result**: ☐ pass ☐ fail

### 5. Import + dialogs at 360 px

- **Steps**: `/import`. Paste a fixture markdown that triggers all
  six entity types (or load via file picker). Select an existing
  populated profile. Land on **ConfirmDialog with all 6 toggles**.
  Reset-all from `/settings`. Open ExportDialog.
- **Expected**:
  - Paste textarea fills the width; file CTA visible.
  - ProfileSelectionScreen list scrolls vertically only.
  - PreviewScreen disclosures expand without horizontal scroll.
  - **ConfirmDialog**: every toggle label wraps to ≤ 2 lines, all
    six checkboxes visible, confirm button reachable. Tier 1 +
    Q5 unit test asserted the structural invariants; this scenario
    confirms the visual fit at real pixels.
  - ResetAllDataDialog inputs and confirm button fit.
  - ExportDialog format buttons fit on one row or wrap cleanly.
- **Result**: ☐ pass ☐ fail

### 6. AI chat at 360 px

- **Steps**: `/chat`. Send a message. Observe MessageBubble layout.
- **Expected**:
  - Bubble at `max-w-[85%]` does not push the input bar off-screen.
  - Send button + textarea row fits the viewport width.
- **Result**: ☐ pass ☐ fail

### 7. Settings at 360 px

- **Steps**: `/settings`. Walk every section (Theme, AutoLock,
  Backup-Import, AI-config, Legal, Reset-All).
- **Expected**:
  - AutoLock 5-preset radio row wraps via `flex-wrap`.
  - Theme picker sits flush with section heading.
  - Backup-import CTA reachable.
  - LegalSection links stack vertically.
- **Result**: ☐ pass ☐ fail

### 8. Onboarding at 360 px

- **Steps**: incognito tab, `/`. Walk `/welcome` → `/privacy` →
  `/setup`. Lock, return to `/unlock`. From welcome:
  `/backup/import/select` → `/backup/import/unlock`.
- **Expected**:
  - `/welcome` logo + tagline + 3 trust signals + CTA fit without
    scroll on an 800 px tall viewport.
  - `/privacy` 3 paragraphs read comfortably.
  - `/setup` zxcvbn meter fits below the password input;
    "Ich habe verstanden" checkbox + label both visible.
  - `/unlock` rate-limit countdown does not jitter the layout
    (`aria-live="polite"` should not relayout).
  - `/backup/import/select` file CTA reachable.
  - `/backup/import/unlock` password field fits.
- **Result**: ☐ pass ☐ fail

### 9. Dark mode at 360 px

- **Steps**: toggle theme, repeat scenarios 1-8 in dark.
- **Expected**: every scenario above passes equally in dark. Spot
  contrast: `dark:bg-*` containers do not bleed into siblings; focus
  rings remain visible.
- **Result**: ☐ pass ☐ fail

### 10. 768 px

- **Steps**: switch to 768 px viewport. Walk `/profile`,
  `/observations`, `/settings`.
- **Expected**:
  - NavBar side panel renders (hamburger hidden).
  - Grid layouts (settings sections, profile sections) reflow to 2-col
    where designed.
  - No 360-px-only adjustments unintentionally degrade at 768 px.
- **Result**: ☐ pass ☐ fail

### 11. 1024 px

- **Steps**: switch to 1024 px. Walk `/profile`, `/timeline`,
  `/license`.
- **Expected**:
  - Side panel + main + any right-rail visually proportional.
  - Long-form content (timeline notes, license text) does not stretch
    beyond a comfortable reading measure (~80 char).
- **Result**: ☐ pass ☐ fail

## Findings

User adds findings here during the walk. One bullet per finding. Tag
each with severity (A / B / C) and the scenario number.

- (none yet)

## Sign-off

Tick each criterion when the matching walk-through is complete and
acceptable. Final signature + date when the file is fully walked.

- ☐ All scenarios at 360 px walked
- ☐ All scenarios at 768 px walked
- ☐ All scenarios at 1024 px walked
- ☐ Light mode verified
- ☐ Dark mode verified at 360 px
- ☐ All Category A findings registered as `P-01a..n` ROADMAP sub-tasks
- ☐ Audit-doc reference link still resolves

Walker: ____________________
Date: 2026-__-__
