# Prompt: Mutation-Nightly Workflow Diagnosis

The `mutation-nightly` workflow has been red since 2026-04-17 (last green). As of today (2026-04-21), that is 3-4 nightly runs red in a row.

Failure manifests as Stryker initial dry-run timeout:

```
03:02:49 DryRunExecutor Starting initial test run (vitest test runner with "perTest" coverage analysis)
03:07:51 ERROR DryRunExecutor Initial test run timed out!
```

5 minutes from start to timeout. `stryker.crypto.mjs` config, 5 files mutated (crypto scope), 78 mutants.

This is failing at the initial dry-run, BEFORE any mutation work begins. Stryker runs the full Vitest suite once with perTest coverage analysis to map which tests cover which files. The timeout means **the test suite itself (not mutation work) now exceeds the timeout**.

## Turn 1: Diagnose first

Do not propose a fix until root cause is identified. Investigate in order.

### Step 1: Identify the first red run

```bash
gh run list --workflow=mutation-nightly.yml --limit 10
```

Report:

- Date + commit SHA of last green run (expected ~2026-04-17)
- Date + commit SHA of first red run (expected ~2026-04-18)
- Every run since that has been red
- Duration of each (did they timeout at 5 min? longer? inconsistent?)

### Step 2: What changed between last green and first red?

```bash
gh run view <last-green-run-id> | grep "commit"
gh run view <first-red-run-id> | grep "commit"
git log <last-green-sha>..<first-red-sha> --oneline
```

Report the full commit list between the two runs. That's the suspect range.

### Step 3: Test-suite duration baseline

Run the exact Vitest command Stryker uses, locally or in a fresh workflow step, and time it.

```bash
time npx vitest run
```

Report wall-clock duration. Expected: if the test suite alone runs >2-3 minutes, Stryker's perTest coverage overhead (typically 2-3x multiplier) will push total over 5 minutes and trigger timeout.

Also report: number of test files, test count, and any tests taking >1s individually (Vitest reports slow tests at end of run).

### Step 4: Review stryker.crypto.mjs config

Read the config file. Report:

- `coverageAnalysis` value (expected: `"perTest"`)
- `timeoutMS` value (Stryker's per-test timeout, not the CI workflow timeout)
- `testRunner` config (any custom Vitest options?)
- `mutate` pattern (what files are scoped for mutation?)
- Any existing performance configs

### Step 5: Review nightly workflow file

Read `.github/workflows/mutation-nightly.yml` (or whatever the actual filename is):

- Job-level `timeout-minutes` value
- Any `--timeout` flags passed to make target
- What environment (runner type, Node version)

### Step 6: Correlation with recent commits

Given the last-green date (~2026-04-17) and the Onboarding series timeline, identify likely culprit commits. Candidates to investigate in the suspect range:

- ONB-01c (db68588): zxcvbn-ts integration, added async tests
- ONB-01d (8414a19): rate-limiter tests, async timer interactions
- ONB-01e (fbe5981): populateVault crypto round-trip tests (potentially slow with real PBKDF2 iterations at 1.2M)
- ONB-01f (9527861): ProtectedRoute update + e2e test suite expansion
- Coverage fix (e6a1884): 4 new tests in useSetupVault, SetupView, useLazyZxcvbn
- ImportFlow fix (00f64a4): bootstrap-load rejection swallow

The populateVault tests in ONB-01e are suspicious. PBKDF2 at 1.2M iterations takes ~800-1600ms per derivation. If populateVault tests derive keys in test setup (not mocked), each test adds significant duration.

Also suspicious: useSetupVault coverage-gap tests from e6a1884. If those tests trigger real crypto paths rather than mocking them, same PBKDF2 cost applies.

## Turn 1 report

Send these artifacts before proposing any fix:

1. Run history with dates, SHAs, durations
2. Commit list in suspect range
3. Local `time npx vitest run` output with slow-test breakdown
4. `stryker.crypto.mjs` config content
5. Workflow YAML content
6. Analysis: which commit most likely caused the regression and why

## Turn 2: Fix strategy

Once root cause is identified, fix options in order of preference:

**Option A: Mock slow crypto in affected tests.**

If populateVault or useSetupVault tests run real PBKDF2, mock the derivation. Keep a small number of integration tests that exercise real crypto, mock the rest. This addresses root cause and makes the suite faster for developers too.

**Option B: Adjust Stryker config for faster dry-run.**

- `coverageAnalysis: "all"` is faster than `"perTest"` but less precise. Acceptable for nightly mutation testing.
- Increase Stryker's `timeoutMS` if individual tests legitimately need more time.
- Split into multiple smaller Stryker configs (e.g., `stryker.crypto.mjs` stays scoped, but the dry run excludes slow test files).

**Option C: Increase CI workflow timeout.**

`timeout-minutes` in the workflow file. Buys breathing room but does not fix the underlying issue. Acceptable as temporary bandaid while A or B is implemented.

Recommendation lean: A if the data shows crypto-in-tests is the culprit. A + C combination (fix + safety margin) if suite is genuinely on the edge.

Do not pick bandaid C alone. The suite will grow further and the problem returns.

## Do not

- Do not guess. Diagnose with run-history + timing data first.
- Do not propose fixes that bypass mutation testing for affected files. The crypto code is exactly where mutation testing has highest value.
- Do not reduce test count to fit the timeout. Coverage gaps were just filled; reducing tests would reopen them.
- Do not disable the workflow. Mutation testing exists for a reason; silencing it is worst option.

## Context

Main app deployment is green (commit 00f64a4 deployed successfully). This diagnosis is about restoring mutation testing as a quality gate, not blocking shipping.

The mutation-nightly workflow runs separately from the main CI gate. It is advisory quality signal, not a deploy-blocker. But 3+ days red means real regressions could land in mutation-uncovered code without warning.
