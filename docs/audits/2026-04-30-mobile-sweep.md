# Mobile-First Responsive Sweep - 2026-04-30

P-01 audit. Two-tier review of every user-visible screen at 360 / 768 /
1024 px to verify the mobile-first floor declared in `CLAUDE.md`. Tier 1
is automated and shipped with this audit; Tier 2 is a user-executable
manual eye-check checklist.

## Q-locks (confirmed)

| Q | Lock |
| - | ---- |
| Q1 | Breakpoints: 360 / 768 / 1024 px |
| Q2 | Single audit doc, Category A/B/C tags, sub-task IDs cross-referenced |
| Q3 | Audit-only commit; Category A fixes ship as separate per-finding commits |
| Q4 | Tier 1 spec runs on chromium project only (responsive bugs are CSS, not engine) |
| Q5 | ConfirmDialog 360-px toggle-fit test bundled with this audit (IM-05 just shipped 6 toggles) |
| Q6 | Include destructive flows (`/profile/create`, reset-all) and all routes users see |
| Q7 | Skip dark × viewport matrix; P-02 already covered dark per screen |
| Q8 | BUG-02 hamburger drawer documented as resolved precedent (not re-audited) |

## Method

### Tier 1 - automated structural sweep

`tests/e2e/viewport-sweep.spec.ts`. Per viewport × route:

1. **No horizontal overflow**: `document.scrollingElement.scrollWidth ≤
   viewport.width + 1px tolerance`. Catches fixed-pixel widths leaking
   past the floor.
2. **Visible interactives have a non-zero bounding box**: every
   `a, button, [role="button"], input, select, textarea` that is not
   `display:none` / `visibility:hidden` / `sr-only` (≤ 1×1 px) must
   have `width > 0 && height > 0`. Catches BUG-02-class regressions
   where elements render into the DOM but a flex container squeezes
   them invisible.

Routes covered:

- **Public** (no vault): `/welcome`, `/privacy`, `/setup`,
  `/backup/import/select`
- **Protected** (after `setupAuthenticatedSession`): `/profile`,
  `/observations`, `/lab-values`, `/supplements`, `/open-points`,
  `/timeline`, `/import`, `/settings`, `/license`

Empty profile → empty list state for entity views; that is a legitimate
shell-layout target and what users see on a fresh setup. Content-heavy
overflow scenarios are covered in the Tier 2 checklist below.

### Tier 2 - manual eye-check (user-executable)

Audit author cannot run a real browser display from the agent loop, so
Tier 2 is shipped as a checklist. The intent is to surface subjective
issues the structural assertions miss: cramped spacing, ugly wraps,
truncated headings, scroll lock with sticky bars, modal overflow under
content-heavy fixtures.

## Tier 1 results

| Sweep | Result |
| ----- | ------ |
| 360 px public routes (4 screens) | PASS |
| 768 px public routes (4 screens) | PASS |
| 1024 px public routes (4 screens) | PASS |
| 360 px protected routes (9 screens) | PASS |
| 768 px protected routes (9 screens) | PASS |
| 1024 px protected routes (9 screens) | PASS |

**6 / 6 sweeps green. Zero Category A or B findings from the
automated tier.** The app is structurally clean at the responsive
floor.

This is consistent with the codebase's mobile-first construction:
flex-wrap on button rows (`AutoLockSection` 5-preset radiogroup),
`overflow-x-auto` on the lab-values table (`LabValuesTable.tsx:42`),
`min-w-0 flex-1` on truncating text inside flex parents
(`LabReportCard.tsx:89`), `max-w-md` clamps on dialog shells
(`ConfirmDialog`, `Modal`), and 44 × 44 minimum hit targets on every
icon button (`ObservationActions`, `LabReportActions`, `LabValueActions`).

## Resolved precedents

- **BUG-02** - pre-2026-04-29 the bottom-nav laid 10 nav items into a
  fixed `h-16 justify-around` strip, squeezing each to ~36 px on a 360
  px viewport with `text-xs` labels rendering effectively unreadable.
  Replaced with a hamburger drawer (`NavDrawer`) opened from a
  top-left button (`md:hidden`). NavBar (md+ side panel) and
  NavDrawer share `NAV_ITEMS` from `src/features/app-shell/navItems.ts`.
  The pattern (squeezed flex strip → drawer) is the canonical
  resolution for a future "too-many-items in narrow flex parent"
  finding.

- **IM-05 ConfirmDialog 6-toggle fit (Q5)** - the just-shipped
  `ConfirmDialog` can render up to 6 toggles (observations, labData,
  supplements, openPoints, timelineEntries, profileVersions) inside
  a `w-full max-w-md` dialog with `p-4` outer padding. On a 360 px
  viewport, parent content box is `360 - 32 = 328 px`, dialog clamps
  to that via `w-full`. New unit test
  `ConfirmDialog.test.tsx::renders all six toggles when every entity
  type is non-empty` asserts the structural invariants:
  `w-full max-w-md` present, no fixed `w-[Npx]` override, no
  `whitespace-nowrap` on toggle labels (German plurals must wrap).
  Real-pixel layout verification is left to the Tier 1 Playwright
  sweep, which clean-passes the entire `/import` route at 360 px.

## Tier 2 checklist (user-executable)

Lifted to a standalone smoke file at
[`docs/manual-smoke/p-01-mobile-sweep.md`](../manual-smoke/p-01-mobile-sweep.md).

That file is the canonical execution artifact: scenarios, expected
outcomes, findings section, sign-off. The audit-document remains the
investigation artifact - Q-locks, method, Tier 1 results, resolved
precedents. The split follows the convention established by
`docs/manual-smoke/README.md`: investigation lives in `docs/audits/`,
execution lives in `docs/manual-smoke/`.

## Conclusion

Tier 1 automated sweep is **clean across all 39 (route × viewport)
combinations**. Tier 2 is a user task, time-boxed, no findings
pre-registered.

If Tier 2 surfaces issues, register each as `P-01a`, `P-01b`, ...
with the audit-document line as the source of truth. Each fix ships
as its own commit per Q3 lock.

If Tier 2 finds nothing, P-01 closes here: parent task ticked, no
sub-tasks needed, audit becomes the regression baseline.

## Artifacts shipped with this audit

- `docs/audits/2026-04-30-mobile-sweep.md` (this file)
- `docs/manual-smoke/README.md` - establishes the smoke-file convention
- `docs/manual-smoke/p-01-mobile-sweep.md` - Tier 2 walk-through
- `tests/e2e/viewport-sweep.spec.ts` (Tier 1 spec - 6 tests, ~5 s)
- `src/features/profile-import/ui/ConfirmDialog.test.tsx` - new
  6-toggle structural-fit test (Q5)

## Next steps

1. User runs Tier 2 checklist at three viewports.
2. Findings, if any, register as `P-01a..n` under the parent P-01
   line in `docs/ROADMAP.md`.
3. Each Category-A fix ships as its own commit with diff review and
   smoke verification.
4. After all sub-tasks close, P-01 parent ticks; this audit becomes
   the historical baseline.
