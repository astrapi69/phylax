# ADR-0011: Mutation Testing Strategy

**Date:** 2026-04-16
**Status:** Accepted

## Context

Phylax has 590 unit tests with 95%+ line coverage across crypto, DB,
and domain modules. Line coverage measures whether code is executed
during testing, not whether the tests make meaningful assertions about
the code's behavior. A test that calls a function but never checks its
return value achieves the same coverage as one that exhaustively
validates every edge case.

Mutation testing addresses this gap. It systematically changes the
production code (introduces mutants) and re-runs the test suite. If a
test fails, the mutant is "killed" (good: the test detected the
change). If all tests pass, the mutant "survived" (bad: the tests are
not sensitive to that behavioral change).

Two concrete examples from the T-04 series illustrate why this matters:

1. **ProfileRepository.getCurrentProfile** (T-04c): the multi-profile
   `console.warn` guard (`if (rows.length > 1)`) had 100% line coverage
   but no negative assertion. Stryker mutated the condition to
   `if (true)` and `if (rows.length >= 1)`, both survived. Fix: added
   an assertion that `console.warn` is NOT called for a single profile.
   A silent behavioral regression (warning on every load) would have
   gone undetected.

2. **importProfile merge fallbacks** (T-04g): the `??` fallback logic
   for weightHistory, currentMedications, managedBy, and other fields
   was tested only in the "parsed field is present" path. Stryker
   flipped `??` to `&&`, and all tests still passed. Fix: added a test
   with undefined parsed fields verifying fallback to existing values.
   A real import scenario (partial profile update) would have silently
   lost existing data.

Both gaps were masked by 100% line coverage.

## Decision

Adopt Stryker.js as the mutation testing framework, run nightly against
four critical modules, with per-module break thresholds.

### Tool choice

**Stryker.js** (v9.6.1) with:

- `@stryker-mutator/vitest-runner`: integrates with the existing Vitest
  test suite. No separate test harness needed.
- `@stryker-mutator/typescript-checker`: rejects mutants that produce
  TypeScript compile errors before running tests. This eliminates false
  positives from type-incompatible mutations (e.g., changing a string
  return to a number) and reduces runtime.

Alternatives considered:

- Manual review of test quality: does not scale and depends on reviewer
  discipline.
- Property-based testing (fast-check): complementary but addresses
  input diversity, not assertion strength. Orthogonal concern.

### Scope

Four modules are in scope, chosen by risk and testability:

| Module       | Path                                         | Rationale                                                                            |
| ------------ | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Crypto       | `src/crypto/**/*.ts`                         | Security-critical. A missed behavioral change here can silently weaken encryption.   |
| Repositories | `src/db/repositories/**/*.ts`                | Data integrity. Encrypt-before-write, decrypt-after-read, CRUD correctness.          |
| Parser       | `src/features/profile-import/parser/**/*.ts` | Complex parsing with many branches. Fixture-based tests have inherent coverage gaps. |
| Import       | `src/features/profile-import/import/**/*.ts` | Transaction logic, merge semantics, error handling.                                  |

**Excluded from scope:**

- React UI components (`src/features/*/`): JSX mutations produce
  mostly equivalent mutants (reordering props, changing className
  strings). The signal-to-noise ratio is too low to justify the
  runtime cost.
- Test scaffolding (`test-setup.ts`, `test-helpers.ts`): not production
  code.
- Barrel exports (`index.ts`): re-exports with no logic.

### Per-module thresholds

Measured baselines and break thresholds (2026-04-16):

| Module       | Measured score | Break threshold | Headroom |
| ------------ | -------------- | --------------- | -------- |
| Crypto       | 100.00%        | 95%             | 5%       |
| Repositories | 100.00%        | 95%             | 5%       |
| Parser       | 57.81%         | 55%             | 2.81%    |
| Import       | 81.16%         | 75%             | 6.16%    |

Policy: `break = measured - 5` (rounded down). This absorbs minor
measurement variance (Stryker's per-test coverage analysis can shift
slightly between runs) without masking real regressions.

Crypto and repositories start at the ceiling. Parser starts low
because section parsers rely on a single integration fixture; edge-case
branches are largely untested. Import is mid-range with known gaps in
per-entity-type counting and merge-field fallback branches.

### Frequency

- **Nightly** on `main` via GitHub Actions cron (`0 2 * * *`).
  Each module runs sequentially with its own config and threshold.
  Combined runtime: ~20 minutes. Workflow timeout: 60 minutes.
- **Manual** via `workflow_dispatch` for on-demand checks.
- **Not per-commit**: full mutation runs take 20+ minutes, too slow
  for the commit-push feedback loop. Unit tests, lint, typecheck,
  and bundle-size checks remain per-commit gates.

### Survivor handling

Every surviving mutant is categorized:

- **Category A (fix)**: real test gap, fixable with a quick test
  addition. Fix immediately in the same commit or micro-task.
- **Category B (exclude)**: equivalent mutant or test-environment
  limitation. Exclude inline with `// Stryker disable next-line ...`
  and a one-line justification next to the code.
- **Category C (defer)**: real gap but requires substantial new test
  fixtures or edge-case inputs. Document in the commit message and
  defer to a dedicated test-hardening task.

### Configuration

- Base config: `stryker.config.mjs` (all modules, lowest threshold).
- Per-module configs: `stryker.crypto.mjs`, `stryker.repos.mjs`,
  `stryker.parser.mjs`, `stryker.import.mjs`. Each imports the shared
  base and overrides `mutate` and `thresholds`.
- Make targets: `test-mutation-quick` (crypto), `test-mutation-repos`,
  `test-mutation-parser`, `test-mutation-import`, `test-mutation` (all).

### Dev-only audit advisories

Stryker's transitive dependency tree introduces 4 high-severity npm
audit advisories. All are dev-only (`npm audit --omit=dev` reports 0
vulnerabilities). No runtime impact. These are transitive deps of
Stryker's tooling (inquirer, chalk, etc.), not controllable by the
project. Documented here for transparency; no action required unless
Stryker releases a patch.

## Consequences

### Positive

- Tests are validated for assertion strength, not just execution
  coverage. Real behavioral gaps surfaced and fixed in T-04c, T-04e,
  T-04g (12 Category A fixes across the series).
- Per-module thresholds prevent regression without penalizing modules
  at different maturity levels.
- Nightly cadence catches drift early without slowing the commit loop.

### Negative

- Three dev dependencies added (`@stryker-mutator/core`,
  `@stryker-mutator/vitest-runner`,
  `@stryker-mutator/typescript-checker`). Dev-only, no runtime impact.
- Nightly CI runner time: ~20 minutes. Acceptable for a nightly job.
- Parser's 55% threshold is low but honest. Raising it requires
  per-section edge-case fixtures, which is a substantial task.

### Ratcheting up

Thresholds move upward when test-hardening work lands. The update is
made in the same commit that improves the score, with the new baseline
documented in the commit message. Thresholds never move downward
without a documented justification (e.g., a module is split or
refactored in a way that invalidates existing mutants).

Parser is the primary candidate for improvement. Sample triage in
T-04f showed ~25% Category A survivors (quick fixes), ~45% Category B
(equivalent), ~30% Category C (needs new fixtures). A dedicated parser
test-hardening task could raise the score to 70-75% by addressing the
Category A items and adding targeted edge-case fixtures.
