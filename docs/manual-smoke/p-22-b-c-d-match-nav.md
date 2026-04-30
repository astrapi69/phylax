# P-22b/c/d match-nav polish manual smoke

Up / Down match navigation across Lab-Values, Supplements, Open-Points
(P-22b/c/d-polish). Vitest covers: button visibility per matchCount,
state machine via `useActiveMatch` lib hook, click wiring. This smoke
covers what automation cannot: real-browser scrollIntoView, sticky-bar
overlap behaviour, `prefers-reduced-motion` honour, dark-mode contrast,
and the cross-view UX consistency check.

## Setup

1. **Browser**: Chrome with DevTools.
2. **Fixture**: authenticated session with enough rows in each view to
   exercise nav: at least 3 lab reports (different dates), 3 supplement
   categories (daily / regular / paused), and 3 open-point contexts.
3. **Theme matrix**: scenarios 1-4 in light, scenario 6 in dark.

## Scenarios

### 1. Lab-Values: Up / Down nav scrolls between matched reports

- **Steps**: `/lab-values`. Open header search. Type a broad query
  matching at least 2 reports (e.g. a category name shared across
  reports). Click the down chevron next to the match counter; click
  the up chevron.
- **Expected**:
  - Counter shows "1 von N Treffer" before nav, increments on each
    next, decrements on each prev. Wraps at boundaries.
  - Each click scrolls the matched report card into view, centred,
    not hidden under the sticky search bar (`scroll-mt-24`).
  - Smooth scroll on default; instant scroll if OS has reduced-motion.
- **Result**: ☐ pass ☐ fail

### 2. Supplements: Up / Down nav cycles through groups

- **Steps**: `/supplements`. Open header search. Broad query matching
  >= 2 category groups. Click chevrons.
- **Expected**: same as scenario 1 but groups instead of reports.
- **Result**: ☐ pass ☐ fail

### 3. Open-Points: Up / Down nav cycles through context groups

- **Steps**: `/open-points`. Open header search. Broad query matching
  >= 2 context groups. Click chevrons.
- **Expected**: same as scenario 1 but context groups.
- **Result**: ☐ pass ☐ fail

### 4. Enter / Shift-Enter from the search input drives nav

- **Steps**: In any of the three views with an active query and >= 2
  matches, focus the search input. Press Enter. Press Shift-Enter.
- **Expected**:
  - Enter moves to next match. Shift-Enter moves to previous.
  - Counter updates accordingly. Scroll animates as in the chevron
    path.
- **Result**: ☐ pass ☐ fail

### 5. Buttons hidden when matchCount < 2

- **Steps**: Type a query that retains exactly one row / group.
- **Expected**: Counter shows "1 von 1 ..." (no `/`), nav buttons
  hidden (no chevrons rendered).
- **Result**: ☐ pass ☐ fail

### 6. Dark mode legibility

- **Steps**: Toggle theme to dark. Walk scenarios 1-3 in dark.
- **Expected**: Chevron buttons retain visible borders + hover state
  on dark background; counter text legible against the sticky bar.
- **Result**: ☐ pass ☐ fail

### 7. 360 px viewport

- **Steps**: DevTools Device Mode at 360 px. Walk scenario 1.
- **Expected**:
  - Counter + chevrons fit in the sticky bar; SearchInput wraps to
    next row if needed (`flex-wrap` already in place).
  - Hit targets remain 44 x 44.
- **Result**: ☐ pass ☐ fail

### 8. UX consistency across all four views

- **Steps**: Walk Observations, Lab-Values, Supplements, Open-Points
  in sequence with the same query approach.
- **Expected**: nav chrome looks and behaves identically in all four
  views (the goal of the polish).
- **Result**: ☐ pass ☐ fail

## Findings

- (none yet)

## Sign-off

- ☐ Lab-Values nav scrolls between matched reports (scenario 1)
- ☐ Supplements nav scrolls between matched groups (scenario 2)
- ☐ Open-Points nav scrolls between matched groups (scenario 3)
- ☐ Enter / Shift-Enter drives nav (scenario 4)
- ☐ Buttons hidden when matchCount < 2 (scenario 5)
- ☐ Dark mode legible (scenario 6)
- ☐ 360 px fit (scenario 7)
- ☐ UX consistency across all four views (scenario 8)

Walker: ____________________
Date: 2026-__-__
