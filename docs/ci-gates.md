# CI Gates

## Required checks on `main`

The `main` branch should require these CI checks from
`.github/workflows/ci.yml` before a pull request can merge:

- `lint-typecheck`
- `unit-tests`
- `e2e-dev`
- `e2e-production`
- `build`

Enforced via GitHub repo settings -> Branches -> Branch protection rules
for `main`. Not expressible in YAML: if branch protection is not
configured (or the required-checks list is out of sync with the
workflow), CI can stay green while the gate is effectively off.

Verify the required-checks list after:

- adding a new job to `ci.yml`
- renaming an existing job
- transferring the repository
- setting up a fresh clone that will receive pushes

## Playwright E2E jobs

`e2e-dev` and `e2e-production` are hardened with:

- `timeout-minutes: 15` per job: bounds runaway runs that would
  otherwise consume the full Actions minute budget on a hang.
- `playwright-report/` upload on failure with 14-day retention: makes
  remote failures reproducible without re-running the suite locally.
  Download the artifact from the failed workflow run and open
  `index.html` to inspect per-test traces, screenshots, and logs.

Retries and Playwright-level timeouts live in
`playwright.config.base.ts` (`retries: process.env.CI ? 2 : 0`).
Per-test timeouts use Playwright defaults.

## Nightly

`mutation-nightly.yml` is not part of the PR gate. Runs at 02:00 UTC
against `main`. Per-module thresholds enforced independently (see
`.claude/rules/quality-checks.md`).
