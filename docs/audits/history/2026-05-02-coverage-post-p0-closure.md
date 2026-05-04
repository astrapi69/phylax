# Coverage Audit

**Audit date:** 2026-05-02
**Commit:** 0f1bbcc (post-P0-closure)
**Tool:** Vitest 4 + `@vitest/coverage-v8` (ADR-0016)
**Run:** `make test-coverage` (Node 24.15.0)

## Project totals

| Metric     | Coverage | Project threshold (vite.config.ts) | Pass |
| ---------- | -------- | ---------------------------------- | ---- |
| Statements | 91.58%   | 90%                                | yes  |
| Branches   | 83.43%   | 80%                                | yes  |
| Functions  | 92.90%   | 92%                                | yes  |
| Lines      | 93.91%   | 92%                                | yes  |

## Per-module status (vs `.claude/rules/quality-checks.md`)

The v8 reporter elides directories that pass 100% across all metrics.
Modules that do not appear in the table below (`src/crypto/`,
`src/db/repositories/`, `src/domain/`, `features/not-found`,
`features/search-trigger`) are at 100% on every metric and meet
their per-module thresholds.

| Module                     | Stmts | Branch | Func  | Lines | Threshold (Lines) | Pass |
| -------------------------- | ----- | ------ | ----- | ----- | ----------------- | ---- |
| `src/db` (root only)       | 96.58 | 87.73  | 96.77 | 98.92 | 95%               | yes  |
| `src/lib`                  | 94.89 | 90.47  | 100   | 97.22 | 90%               | yes  |
| `src/router`               | 96.20 | 91.11  | 100   | 100   | 85%               | yes  |
| `src/i18n`                 | 87.75 | 71.42  | 92.30 | 92.68 | 85%               | yes  |
| `src/ui`                   | 92.30 | 89.53  | 97.61 | 95.83 | 85%               | yes  |
| `src/ui/Modal`             | 95.83 | 92.68  | 100   | 100   | 85%               | yes  |
| `features/ai`              | 91.69 | 78.21  | 85.10 | 93.25 | 85%               | yes  |
| `features/ai-chat`         | 91.44 | 85.45  | 92.68 | 95.31 | 85%               | yes  |
| `features/ai-config`       | 94.17 | 86.66  | 94.28 | 96.80 | 85%               | yes  |
| `features/app-shell`       | 100   | 89.65  | 100   | 100   | 85%               | yes  |
| `features/auto-lock`       | 100   | 92.30  | 100   | 100   | 85%               | yes  |
| `features/backup-export`   | 86.23 | 74.07  | 100   | 86.53 | 85%               | yes  |
| `features/backup-import`   | 84.92 | 77.14  | 92.64 | 86.64 | 85%               | yes  |
| `features/document-import` | 92.93 | 82.80  | 94.69 | 95.90 | 85%               | yes  |
| `features/documents`       | 85.98 | 73.29  | 85.71 | 89.46 | 85%               | yes  |
| `features/donation`        | 98.86 | 95.65  | 100   | 98.75 | 85%               | yes  |
| `features/export`          | 84.87 | 72.13  | 90.57 | 86.49 | 85%               | yes  |
| `features/lab-values`      | 92.11 | 89.08  | 92.80 | 96.55 | 85%               | yes  |
| `features/observations`    | 91.78 | 88.67  | 88.18 | 96.13 | 85%               | yes  |
| `features/onboarding`      | 97.43 | 90.90  | 100   | 98.31 | 85%               | yes  |
| `features/open-points`     | 92.97 | 86.82  | 94.93 | 95.83 | 85%               | yes  |
| `features/profile-create`  | 94.11 | 92.00  | 80.00 | 93.93 | 85%               | yes  |
| `features/profile-import`  | 94.68 | 94.40  | 97.36 | 95.34 | 85%               | yes  |
| `features/profile-list`    | 100   | 83.33  | 100   | 100   | 85%               | yes  |
| `features/profile-view`    | 93.01 | 92.35  | 87.87 | 96.53 | 85%               | yes  |
| `features/reset`           | 87.05 | 66.66  | 93.75 | 89.47 | 85%               | yes  |
| `features/settings`        | 85.43 | 70.23  | 92.85 | 86.71 | 85%               | yes  |
| `features/supplements`     | 94.57 | 89.26  | 98.57 | 98.26 | 85%               | yes  |
| `features/theme`           | 97.10 | 96.42  | 100   | 96.92 | 85%               | yes  |
| `features/timeline`        | 97.43 | 76.19  | 100   | 100   | 85%               | yes  |
| `features/unlock`          | 89.36 | 85.71  | 96.15 | 92.18 | 85%               | yes  |

## Status vs prior audit (2026-05-02 pre-closure, archived in `history/`)

All four P0 line-threshold violations are resolved this session.

| Module                    | Lines (prior) | Lines (now) | Closed by                                            |
| ------------------------- | ------------- | ----------- | ---------------------------------------------------- |
| `features/not-found`      | 0%            | 100%        | commit 654f2c9 (smoke render test)                   |
| `features/search-trigger` | 75.00%        | 100%        | commit 687e37e (route-change effect + inert no-ops)  |
| `src/ui` (ErrorBoundary)  | 82.50%        | 95.83%      | commit 4d50606 (default handlers + legacy clipboard) |
| `features/backup-import`  | 82.10%        | 86.64%      | commits 5824ee0 + 0f1bbcc (full pipeline coverage)   |

Every module now meets or exceeds its declared line threshold.

## Gap queue (sorted by risk, frontend + backend in one queue)

P0 line-threshold violations: **none**. The remaining gaps are all
branch-coverage opportunities (lines pass; selected branches
uncovered), tracked here for continuous improvement, not as
threshold blockers.

### P1 - branch-coverage cliffs (lines pass, branches under 75%)

1. **`features/reset` branches 66.66%** - destructive feature
   (full data wipe). `useResetAllData.ts` storage-API failure
   branches still uncovered.
2. **`features/settings` branches 70.23%** - includes the master
   password change flow (security-relevant).
   `MasterPasswordSection` validation-rejection branches still
   uncovered.
3. **`features/i18n` branches 71.42%** - `config.ts` lines 112-113
   and 126 carry the gap (default-language fallthrough paths).
4. **`features/export` branches 72.13%** - PDF and Markdown export.
   `markdownStripper.ts` and `markdownExport.ts` malformed-input
   edge cases remain.
5. **`features/documents` branches 73.29%** - linked-entity surface.
6. **`features/backup-export` branches 74.07%** - lock-state and
   missing-meta branches in `buildVaultDump.ts`.

### P2 - large-surface modules below 85% branches

7. `features/timeline` branches 76.19% (small surface;
   `useTimeline.ts` lines 42-51).
8. `features/profile-import/ui` branches 77.69%.
9. `features/backup-import` branches 77.14%.

### P3 - small modules with cosmetic gaps

10. `features/profile-create` functions 80% (one helper).
11. `features/lab-values` branches 89.08%.

## Notes

- `src/crypto/`, `src/db/repositories/`, `src/domain/`,
  `features/not-found`, and `features/search-trigger` do not appear
  in the v8 text reporter because every metric is at 100%; the rule
  thresholds are still enforced inside `vite.config.ts`.
- The mutation-testing thresholds in
  `.claude/rules/quality-checks.md` "Mutation testing thresholds"
  remain the source of truth for behavioural coverage; this audit
  measures line / branch / function coverage only.
- Per `.claude/rules/ai-workflow.md` "Running a coverage audit", the
  next audit must `git mv` this file to
  `docs/audits/history/YYYY-MM-DD-coverage.md` (where
  `YYYY-MM-DD` is the date in this header) before writing a new
  `current-coverage.md`. The prior version is archived as
  `docs/audits/history/2026-05-02-coverage.md`.
