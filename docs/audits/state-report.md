# State Report

**Audit date:** 2026-04-12

## Environment

- Project moved from external T7 Shield drive (no symlink support) to local HDD
- All npm scripts currently use explicit `node ./node_modules/...` paths (workaround for old environment)
- Symlinks now work normally, cleanup to standard invocations pending

## Task completion status

| Task   | Description                                      | Status            | Commit    |
|--------|--------------------------------------------------|-------------------|-----------|
| **F-01** | Vite + React + TypeScript + Tailwind setup     | Done              | `0e9ad91` |
| **F-02** | Folder structure scaffold                      | Done              | `ccfa3cc` |
| **F-03** | ESLint rules for crypto/dexie import boundaries | Done             | `0143e18` |
| **F-04** | Husky + lint-staged pre-commit hook            | Not done          |           |
| F-05 to F-18 | Remaining foundation tasks                | Not started       |           |

ROADMAP checkboxes for F-01 to F-03 have not been updated yet (bookkeeping debt).

## Project state consistency

- Working tree: **clean**, no uncommitted changes
- Branch: **main**, 4 commits ahead of `origin/main` (not pushed)
- `dist/` folder exists on disk, covered by `.gitignore`
- `.idea/` folder exists on disk, **not in `.gitignore`** (to be added)
- No `.husky/` folder (F-04 not yet implemented)
- No `lint-staged` config in `package.json`
- No `prepare` script in `package.json`

## Key constraints (quick reference)

1. **`crypto.subtle`** restricted to `src/crypto/` only. Enforced by ESLint `no-restricted-globals`, lifted for `src/crypto/**/*.ts`.
2. **`dexie`** restricted to `src/db/` only. Enforced by ESLint `no-restricted-imports`, lifted for `src/db/**/*.ts`.
3. **MVP (phases 1-6)** forbids all external API calls at runtime, all cloud/backend services, all telemetry, and all medical advice features.

## Pending actions

1. Write this state report to `docs/audits/state-report.md` (this file)
2. Cleanup commit: revert explicit paths to standard invocations, add `.idea/` to `.gitignore`, check off F-01 to F-03 in ROADMAP
3. Implement F-04: Husky + lint-staged pre-commit hook
4. Push 4 existing commits + new commits to origin
