# Coverage Audit

**Audit date:** 2026-05-02
**Commit:** 9e1ebba (post-P1+P2 closure batch)
**Tool:** Vitest 4 + `@vitest/coverage-v8` (ADR-0016)
**Run:** `make test-coverage` (Node 24.15.0)

## Project totals

| Metric     | Coverage | Project threshold (vite.config.ts) | Pass |
| ---------- | -------- | ---------------------------------- | ---- |
| Statements | 92.09%   | 90%                                | yes  |
| Branches   | 84.17%   | 80%                                | yes  |
| Functions  | 93.11%   | 92%                                | yes  |
| Lines      | 94.37%   | 92%                                | yes  |

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
| `src/i18n`                 | 91.83 | 75.00  | 92.30 | 97.56 | 85%               | yes  |
| `src/ui`                   | 92.30 | 89.53  | 97.61 | 95.83 | 85%               | yes  |
| `src/ui/Modal`             | 95.83 | 92.68  | 100   | 100   | 85%               | yes  |
| `features/ai`              | 91.69 | 78.21  | 85.10 | 93.25 | 85%               | yes  |
| `features/ai-chat`         | 91.44 | 85.45  | 92.68 | 95.31 | 85%               | yes  |
| `features/ai-config`       | 94.23 | 86.95  | 94.44 | 96.84 | 85%               | yes  |
| `features/app-shell`       | 100   | 89.65  | 100   | 100   | 85%               | yes  |
| `features/auto-lock`       | 100   | 92.30  | 100   | 100   | 85%               | yes  |
| `features/backup-export`   | 89.90 | 83.33  | 100   | 90.38 | 85%               | yes  |
| `features/backup-import`   | 84.92 | 77.14  | 92.64 | 86.64 | 85%               | yes  |
| `features/document-import` | 92.93 | 82.80  | 94.69 | 95.90 | 85%               | yes  |
| `features/documents`       | 86.62 | 74.08  | 85.71 | 90.35 | 85%               | yes  |
| `features/donation`        | 98.86 | 95.65  | 100   | 98.75 | 85%               | yes  |
| `features/export`          | 86.31 | 74.51  | 92.02 | 87.58 | 85%               | yes  |
| `features/lab-values`      | 92.11 | 89.08  | 92.80 | 96.55 | 85%               | yes  |
| `features/observations`    | 91.78 | 88.67  | 88.18 | 96.13 | 85%               | yes  |
| `features/onboarding`      | 97.43 | 90.90  | 100   | 98.31 | 85%               | yes  |
| `features/open-points`     | 92.64 | 86.34  | 94.93 | 95.83 | 85%               | yes  |
| `features/profile-create`  | 94.11 | 92.00  | 80.00 | 93.93 | 85%               | yes  |
| `features/profile-import`  | 94.68 | 94.40  | 97.36 | 95.34 | 85%               | yes  |
| `features/profile-list`    | 100   | 83.33  | 100   | 100   | 85%               | yes  |
| `features/profile-view`    | 93.01 | 92.35  | 87.87 | 96.53 | 85%               | yes  |
| `features/reset`           | 94.11 | 81.48  | 100   | 94.73 | 85%               | yes  |
| `features/settings`        | 91.39 | 84.52  | 92.85 | 92.30 | 85%               | yes  |
| `features/supplements`     | 94.57 | 89.26  | 98.57 | 98.26 | 85%               | yes  |
| `features/theme`           | 97.10 | 96.42  | 100   | 96.92 | 85%               | yes  |
| `features/timeline`        | 97.43 | 80.95  | 100   | 100   | 85%               | yes  |
| `features/unlock`          | 89.36 | 85.71  | 96.15 | 92.18 | 85%               | yes  |

## Status vs prior audit (2026-05-02 post-P0-closure, archived in `history/`)

Six P1 + two P2 branch-coverage rows closed since the last audit.
Project totals: 91.58% / 83.43% / 92.90% / 93.91% (prior) ->
92.09% / 84.17% / 93.11% / 94.37% (current).

| Module                       | Branch (prior) | Branch (now) | Closed by                                                     |
| ---------------------------- | -------------- | ------------ | ------------------------------------------------------------- |
| `features/reset`             | 66.66%         | 81.48%       | commit 2eca213 (caches + sw wipe paths)                       |
| `features/settings`          | 70.23%         | 84.52%       | commit b79a188 (change-password runtime + render variants)    |
| `i18n`                       | 71.42%         | 75.00%       | commit fd867be (lazyBackend non-EN + missing-namespace)       |
| `features/export`            | 71.92%         | 74.51%       | commit 8de38da (appendix.ts unit + link branches)             |
| `features/documents`         | 70.68%         | 74.08%       | commit e992dc1 (useAttachedDocuments branches)                |
| `features/backup-export`     | 74.07%         | 83.33%       | commit ed6413c (useBackupExport runtime errors)               |
| `features/timeline`          | 76.19%         | 80.95%       | commit 3ab4f13 (useTimeline non-Error rejection fallback)     |
| `features/profile-import/ui` | 78.41%         | 79.85%       | commit 9e1ebba (ImportEntryScreen file-cleared + read-failed) |

Every module continues to meet or exceed its declared line threshold.

## Gap queue (sorted by risk)

P0 line-threshold violations: **none**. Remaining gaps are all
branch-coverage opportunities.

### P2 - branch-coverage at-risk modules (lines pass, branches under 80%)

1. **`features/ai` branches 78.21%** - ai/AiSetupWizard.tsx
   carries the bulk; multi-step wizard surface with many UI
   branches.
2. **`features/backup-import` branches 77.14%** - second pass
   after the P0 closure; remaining gaps live in
   BackupImportSection / SelectView / UnlockView.
3. **`features/i18n` branches 75.00%** - detector.ts cancellation
   guards (lines 44-45, 54, 65-74) are the residual gap; covering
   them needs typeof-globalThis manipulation.
4. **`features/export` branches 74.51%** - ExportDialog.tsx
   (62.73% branches) is the next-largest gap; multi-step UI.
5. **`features/documents` branches 74.08%** - LinkEditor /
   useDocumentUpload / useLinkableEntities residual gaps.

### P3 - small-surface gaps

6. **`features/profile-create` functions 80%** - one helper.
7. **`features/lab-values` branches 89.08%** - LabReportForm
   (96.66%) edge cases.
8. **`features/profile-import/ui` branches 79.85%** -
   ImportFlow.tsx parse-failure cascade (63.15% branches) needs
   a parseable-but-broken markdown fixture.

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
  `docs/audits/history/YYYY-MM-DD-coverage-<suffix>.md` (use a
  suffix to disambiguate when the date repeats; the prior version
  is archived as
  `docs/audits/history/2026-05-02-coverage-post-p0-closure.md`).
