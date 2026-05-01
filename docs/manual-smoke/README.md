# Manual smoke tests

Canonical location for human-executable test plans that automated tests
cannot cover: subjective UX (cramped spacing, ugly wraps), real-browser-
only behavior (service worker activation, IndexedDB eviction), multi-
device verification, A11y screen-reader walks, real-network checks.

Automated tests live in `src/**/*.test.ts*` (Vitest) and `tests/e2e/`
(Playwright). Anything those layers cannot assert lands here.

## When to add a smoke file

Add one when shipping a feature whose verification depends on a human
in front of a real browser. Don't write one for changes that automated
tests already cover.

Common triggers:
- New UI surface: visual fit, hit targets, focus traps
- Service worker / PWA install / update flows: cross-tab + cold-load
- Real-network behavior: AI cleanup, backup round-trip on slow links
- Subjective polish: dark-mode contrast, motion preference, multi-device
- Cross-browser edge cases F-06b matrix surfaces but cannot fix

## Naming convention

`<feature-id>-<short-description>.md`

Examples: `p-01-mobile-sweep.md`, `bug-01-silent-update.md`,
`im-05-confirm-dialog-toggles.md`.

The feature ID matches the ROADMAP task ID. The description is two to
four words, kebab-case.

## File format

Each smoke file follows this skeleton:

```markdown
# <Feature ID> <description> manual smoke

One-line context: what shipped, where the automated layer ends, why a
human eye-check is needed.

## Setup

Browser, device, fixtures, environment toggles.

## Scenarios

Numbered list. Each scenario:
- **Steps** - what to do, in order
- **Expected** - what should happen
- **Result** - pass / fail / partial, filled in by walker

## Findings

User adds findings as they walk. Each finding gets a severity tag
(A / B / C) and a short description. Category A findings register as
follow-up tasks in `docs/ROADMAP.md`.

## Sign-off

Checklist of completion criteria. Walker ticks each, signs with name +
date when the file is fully walked.
```

## Workflow

1. **Create** - feature ships with its smoke file. Empty findings,
   empty sign-off.
2. **Walk** - user runs the smoke at convenience. Fills findings,
   ticks sign-off, commits the completed file.
3. **Triage** - Category A findings register as ROADMAP sub-tasks.
   Category B and C accumulate as a polish backlog.
4. **Archive** - once signed off + all Category A findings closed,
   file moves to `docs/manual-smoke/history/<date>-<file>.md` (or
   stays put if it doubles as a regression baseline; author's call).

## Severity tags

- **A** - structural defect or a11y blocker. Must-fix. Becomes a
  numbered follow-up task.
- **B** - degraded UX (cramped, ugly wrap, inconsistent hit target).
  Polish queue.
- **C** - nice-to-have. Backlog without dedicated task.

Match the audit-document convention so a smoke walker and an audit
reader speak the same language.

## Backlog

Pending smoke files, ordered by ship date. User-driven; CC may suggest
when shipping a feature whose verification crosses the automated/human
boundary.

| Feature | Description | Status |
| ------- | ----------- | ------ |
| P-01 | [Mobile-first viewport sweep](p-01-mobile-sweep.md) | Pending walk |
| P-06 | [Change master password](p-06-change-password.md) | Complete (2026-04-30; P-06a fixed inline) |
| P-09 | [Error boundary](p-09-error-boundary.md) | Complete (2026-04-30; P-09a fixed inline) |
| P-16 | [Document row delete](p-16-document-row-delete.md) | Complete (2026-04-30; BUG-03/04/05/06 fixed inline) |
| P-22b/c/d-polish | [Cross-view match-nav](p-22-b-c-d-match-nav.md) | Pending walk |

When more smoke files ship, add rows above. Mark Status as `Pending
walk` (file created, not yet walked), `In progress` (partial walk),
`Complete` (signed off), or `Archived` (moved to history).
