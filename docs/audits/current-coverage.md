# Coverage Audit

**Audit date:** 2026-05-02
**Commit:** 599b1b6
**Tool:** Vitest 4 + `@vitest/coverage-v8` (ADR-0016)
**Run:** `make test-coverage` (Node 24.15.0, 279 test files, 2632 passed, 1 skipped)

## Project totals

| Metric     | Coverage | Project threshold (vite.config.ts) | Pass |
| ---------- | -------- | ---------------------------------- | ---- |
| Statements | 91.11%   | 90%                                | yes  |
| Branches   | 83.19%   | 80%                                | yes  |
| Functions  | 92.24%   | 92%                                | yes  |
| Lines      | 93.37%   | 92%                                | yes  |

## Per-module status (vs `.claude/rules/quality-checks.md`)

The v8 reporter elides directories that pass 100% across all metrics.
Modules that do not appear in the table below (`src/crypto/`,
`src/db/repositories/`, `src/domain/`) are at 100% on every metric and
meet their per-module thresholds (Crypto 100%, Repositories 95%,
Domain 90%).

| Module                     | Stmts | Branch | Func  | Lines | Threshold (Lines) | Pass   |
| -------------------------- | ----- | ------ | ----- | ----- | ----------------- | ------ |
| `src/db` (root only)       | 96.58 | 87.73  | 96.77 | 98.92 | 95%               | yes    |
| `src/lib`                  | 94.89 | 90.47  | 100   | 97.22 | 90%               | yes    |
| `src/router`               | 96.20 | 91.11  | 100   | 100   | 85%               | yes    |
| `src/i18n`                 | 87.75 | 71.42  | 92.30 | 92.68 | 85%               | yes    |
| `src/ui`                   | 80.00 | 82.55  | 92.85 | 82.50 | **85%**           | **NO** |
| `src/ui/Modal`             | 95.83 | 92.68  | 100   | 100   | 85%               | yes    |
| `features/ai`              | 91.69 | 78.21  | 85.10 | 93.25 | 85%               | yes    |
| `features/ai-chat`         | 91.44 | 85.45  | 92.68 | 95.31 | 85%               | yes    |
| `features/ai-config`       | 94.17 | 86.66  | 94.28 | 96.80 | 85%               | yes    |
| `features/app-shell`       | 100   | 89.65  | 100   | 100   | 85%               | yes    |
| `features/auto-lock`       | 100   | 92.30  | 100   | 100   | 85%               | yes    |
| `features/backup-export`   | 86.23 | 74.07  | 100   | 86.53 | 85%               | yes    |
| `features/backup-import`   | 80.42 | 74.69  | 83.82 | 82.10 | **85%**           | **NO** |
| `features/document-import` | 92.93 | 82.80  | 94.69 | 95.90 | 85%               | yes    |
| `features/documents`       | 85.98 | 73.29  | 85.71 | 89.46 | 85%               | yes    |
| `features/donation`        | 98.86 | 95.65  | 100   | 98.75 | 85%               | yes    |
| `features/export`          | 84.87 | 72.13  | 90.57 | 86.49 | 85%               | yes    |
| `features/lab-values`      | 92.30 | 89.34  | 92.80 | 96.55 | 85%               | yes    |
| `features/not-found`       | 0     | 100    | 0     | 0     | **85%**           | **NO** |
| `features/observations`    | 91.78 | 88.67  | 88.18 | 96.13 | 85%               | yes    |
| `features/onboarding`      | 97.43 | 90.90  | 100   | 98.31 | 85%               | yes    |
| `features/open-points`     | 92.64 | 86.34  | 94.93 | 95.83 | 85%               | yes    |
| `features/profile-create`  | 94.11 | 92.00  | 80.00 | 93.93 | 85%               | yes    |
| `features/profile-import`  | 94.68 | 94.40  | 97.36 | 95.34 | 85%               | yes    |
| `features/profile-list`    | 100   | 83.33  | 100   | 100   | 85%               | yes    |
| `features/profile-view`    | 93.01 | 92.35  | 87.87 | 96.53 | 85%               | yes    |
| `features/reset`           | 87.05 | 66.66  | 93.75 | 89.47 | 85%               | yes    |
| `features/search-trigger`  | 77.77 | 70.00  | 71.42 | 75.00 | **85%**           | **NO** |
| `features/settings`        | 85.43 | 70.23  | 92.85 | 86.71 | 85%               | yes    |
| `features/supplements`     | 94.96 | 89.83  | 98.57 | 98.26 | 85%               | yes    |
| `features/theme`           | 97.10 | 96.42  | 100   | 96.92 | 85%               | yes    |
| `features/timeline`        | 97.43 | 76.19  | 100   | 100   | 85%               | yes    |
| `features/unlock`          | 89.36 | 85.71  | 96.15 | 92.18 | 85%               | yes    |

## Gap queue (sorted by risk, frontend + backend in one queue)

Per `.claude/rules/ai-workflow.md`: frontend and backend gaps share
the same priority queue. Risk = data-integrity / security / blast
radius first, surface area second, age third.

### P0 - threshold violations

1. **`src/ui` 82.50% lines (threshold 85%)** - `ErrorBoundary.tsx`
   is the dominant gap (uncovered lines 79-83, 99-114; 56.09% lines).
   ErrorBoundary catches React render-tree crashes and presents the
   user with a recovery affordance; coverage of the recovery branch
   is the high-leverage add. Recommended action: write a unit test
   that throws inside a child component and asserts the fallback UI
   - reset behavior.
2. **`features/backup-import` 82.10% lines (threshold 85%)** -
   restore is data-integrity critical (a half-applied restore
   leaves the vault in an inconsistent state). `useBackupImport.ts`
   carries the bulk of the gap. Recommended action: add error-path
   tests for partial-decrypt failure and quota-exceeded mid-restore.
3. **`features/not-found` 0% lines (threshold 85%)** - low-risk
   stub view (lines 5-6 only), but the module is in the strict
   threshold scope. Recommended action: a smoke render test.
4. **`features/search-trigger` 75.00% lines (threshold 85%)** -
   `SearchContext.tsx` lines 104-107, 135-137 uncovered. Medium risk
   (search is read-only but used across views). Recommended action:
   add tests for the keyboard-shortcut and outside-click branches.

### P1 - branch-coverage cliffs (lines pass, branches under 75%)

5. **`features/reset` branches 66.66%** - destructive feature
   (full data wipe). `useResetAllData.ts` lines 201-202, 207-208 are
   the visible gap. Recommended action: add tests for the
   storage-API failure branches.
6. **`features/settings` branches 70.23%** - includes the master
   password change flow (security-relevant). `MasterPasswordSection`
   uncovered lines 86, 253, 259-267 cover validation rejection
   branches. Recommended action: assert each
   `useChangeMasterPassword` rejection path.
7. **`features/export` branches 72.13%** - PDF and Markdown
   export. `markdownStripper.ts` and `markdownExport.ts` carry most
   of the gap. Recommended action: add tests for malformed-markdown
   and very-large-input edge cases.
8. **`features/backup-export` branches 74.07%** - same
   data-integrity argument as backup-import. Recommended action:
   add tests for the lock-state and missing-meta branches in
   `buildVaultDump.ts`.

### P2 - large-surface modules below 85% branches

9. `features/documents` branches 73.29%
10. `features/document-import/ui` branches 87.58 (file-level: some
    of the orchestrator components are 75-85% on lines)
11. `features/ai-chat/ui` branches 82.82%

### P3 - small modules with cosmetic gaps

12. `features/profile-create` functions 80% (one helper)
13. `features/timeline` branches 76.19% (small surface, only
    `useTimeline.ts` has uncovered lines 42-51)
14. `features/lab-values` branches 89.34% (LabReportForm 96.66%)

## Notes

- `src/crypto/`, `src/db/repositories/`, `src/domain/` and the
  empty placeholder stubs do not appear in the v8 text reporter
  because every metric is at 100%; the rule thresholds are still
  enforced inside `vite.config.ts` and would fail the run if any
  of these dropped.
- The mutation-testing thresholds in
  `.claude/rules/quality-checks.md` "Mutation testing thresholds"
  remain the source of truth for behavioural coverage; this audit
  measures line / branch / function coverage only. The April 2026
  baseline (Crypto 100%, Repositories 100%, Parser 57.81%, Import
  81.16%) is unchanged.
- Per `.claude/rules/ai-workflow.md` "Running a coverage audit", the
  next audit must `git mv` this file to
  `docs/audits/history/YYYY-MM-DD-coverage.md` (where
  `YYYY-MM-DD` is the date in this header) before writing a new
  `current-coverage.md`.
