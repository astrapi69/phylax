# ADR-0024: Gitflow with per-task feature branches and CI-gated merges

**Date:** 2026-06-29
**Status:** Accepted

## Context

Phylax had been operating under an informal direct-to-main convention
(solo developer, no pull requests). That convention was never captured
in a dedicated ADR; it lived only as incidental prose in `docs/ROADMAP.md`
and `ADR-0023` (the soft-reset "six-step direct-to-main track").

Direct-to-main has a concrete, observed failure mode in this repository:
because nothing gates a push, a red `main` can persist unnoticed. The CI
history shows `main` was red from 2026-06-02 to 2026-06-29 (roughly four
weeks) across the M-series, I18N-03, X-series, and D-04 commits, from two
independent defects (a WebKit E2E helper bug and accumulated coverage
drift) that no pre-merge gate ever surfaced. Each push compounded the
problem instead of being blocked by it.

Returning to Gitflow restores a pre-merge quality gate: CI runs on the
pull request, and a red result blocks the merge instead of landing on the
trunk.

### Rejected alternatives

- **Keep direct-to-main.** Rejected: no pre-merge gate; the four-week red
  `main` above is the direct consequence. A solo developer is exactly the
  case where an automated gate matters most, because there is no second
  reviewer to catch a red push.
- **Trunk-based with short-lived branches but no PR gate.** Rejected:
  without the `pull_request` CI trigger there is still no enforced gate;
  the only reliable enforcement point in this repo is the PR.
- **Rebase- or squash-only with no merge commits at all.** Rejected as the
  sole strategy: it cannot carry a deliberately grouped multi-task PR (see
  the green-restoration bootstrap, which had to land BUG-13 and TD-16
  together because neither could pass the gate alone against the red main).

## Decision

1. **One feature branch per task.** No direct commits to `main`. Every
   change lands through a branch and a pull request targeting `main`.
2. **CI green is required before merge.** The `pull_request` CI run on the
   branch must be fully green (lint, typecheck, unit + coverage, E2E dev,
   E2E production, bundle size). A red check blocks the merge.
3. **Branch naming** follows `type/<TASK-ID>-<short-desc>`:
   - `feature/<TASK>-desc` for features (V-, IM-, O-, E-, AI-, ...)
   - `fix/<BUG-NN>-desc` for bug fixes
   - `chore/<I-NN>-desc` for infrastructure
   - `docs/<TASK>-desc` for documentation- and rule-only changes
     The task ID matches `.claude/rules/task-series.md`.
4. **Merge strategy: squash by default**, producing one commit per task on
   a linear `main` (preserves the existing "Ein Commit pro Task" invariant
   in `CLAUDE.md`). A **merge commit (`--no-ff`) is permitted only when a
   single PR intentionally groups multiple distinct task commits** that
   must remain individually visible in history (for example the
   green-restoration bootstrap PR carrying BUG-13 + TD-16). Rebase-merge is
   not used.
5. **Hotfix exception.** A production-critical fix may branch from `main`
   as `fix/<BUG-NN>-desc` and be fast-tracked, but it still goes through a
   branch and a green CI run before merging. There is no bypass of the
   CI-green gate, only a shortened queue.
6. **TDD ordering applies on the branch** per `.claude/rules/tdd.md`
   (tests first for behavior changes; doc/config-only changes are exempt).

## Consequences

- A red `main` becomes a near-impossible steady state: the gate catches it
  on the PR. (The one-time exception was restoring the already-red `main`,
  documented on the bootstrap PR.)
- Slightly more ceremony per task (branch + PR) in exchange for an enforced
  quality bar. Acceptable for a solo, AI-assisted workflow where the PR is
  the only automated reviewer.
- History stays one-commit-per-task by default; grouped PRs are the
  explicit, documented exception.
- The informal direct-to-main convention is revoked. `CLAUDE.md` and the
  affected rule files are updated in the same change; the prior incidental
  mentions in `ROADMAP.md` / `ADR-0023` are historical and left as-is.
