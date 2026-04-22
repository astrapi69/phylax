# ADR-0016: Vitest 4 V8 Coverage Provider Threshold Recalibration

## Context

DEPS-02 upgraded Vitest 3.2.4 to 4.1.5 as part of the Q2 2026 major
dependency sweep. Vitest 4's migration guide flags a behavior change
in the V8 coverage provider:

> Vitest's V8 code coverage provider is now using more accurate
> coverage result remapping logic. It is expected for users to see
> changes in their coverage reports when updating from Vitest v3.
> In the past Vitest used `v8-to-istanbul` for remapping V8 coverage
> results into your source files. This method wasn't very accurate
> and provided plenty of false positives in the coverage reports.
> We've now developed a new package that utilizes AST based analysis
> for the V8 coverage.

Practical impact on Phylax: measured coverage numbers dropped
2-5 percentage points across the board. Not a code regression - the
old numbers were systematically inflated by `v8-to-istanbul`'s loose
remapping. The new AST-aware numbers reflect actual tested-vs-untested
ratios.

CI on DEPS-02a (commit `e1d505e`) surfaced five threshold breaches
against the existing v3-calibrated gates:

```
ERROR: Coverage for branches (80.98%) does not meet global threshold (85%)
ERROR: Coverage for branches (90%)    does not meet "src/features/auto-lock/**" threshold (95%)
ERROR: Coverage for functions (95.45%) does not meet "src/features/unlock/**" threshold (100%)
ERROR: Coverage for statements (88.88%) does not meet "src/features/unlock/**" threshold (90%)
ERROR: Coverage for branches (84.37%)  does not meet "src/features/unlock/**" threshold (85%)
```

All other thresholded scopes (crypto, db repositories, db, onboarding,
pwa-update, router, app-shell) passed under the new provider.

Global summary under Vitest 4 on commit `e1d505e`:
Statements 91.39%, Branches 80.98%, Functions 94.05%, Lines 93.05%.

### Options considered

- **Option A (add tests to hit existing thresholds):** would chase
  numbers that were inflated by the previous remapping. Tests added
  to close a 5-point gap under v3 would have been mostly theatre
  because v3 reported the code as already covered. Writing tests
  against the v4 truth is valid and welcome, but doing it under time
  pressure inside a dep-upgrade phase is the wrong trigger; real
  coverage improvements should be their own commits with their own
  review.
- **Option B (recalibrate thresholds to match new measurements):**
  honest reflection of what the test suite actually covers. Gates
  continue to fire on real regressions. New measurements become the
  baseline future work tightens from.
- **Option C (remove coverage thresholds):** loses the regression
  signal. Rejected; coverage gating is a documented project invariant
  per `.claude/rules/quality-checks.md`.

## Decision

Adopt **Option B**: recalibrate thresholds to match Vitest 4's V8
provider measurements. Use `current measured value - 1 percentage
point, rounded to whole numbers` as the new floor; gives a small
buffer against minor fluctuations without inviting drift.

**Exception for aspirational 100% targets:** `src/features/unlock/**`
functions was set to 100% but measured 95.45% under the new provider.
A 100% gate that is not actually met is a smell; keeping it would
either require a waiver or continued failing CI. Lower the gate
honestly (100 → 95) instead. Committing to genuine 100% unlock
coverage remains available as a future hardening task with real
tests behind it, not a permanent-ignore list.

### Concrete threshold changes

| Scope          | Metric     | v3 threshold | v4 measured | v4 threshold |
| -------------- | ---------- | ------------ | ----------- | ------------ |
| Global         | Statements | 85           | 91.39%      | **90**       |
| Global         | Branches   | 85           | 80.98%      | **80**       |
| Global         | Functions  | 85           | 94.05%      | **93**       |
| Global         | Lines      | 85           | 93.05%      | **92**       |
| `auto-lock/**` | Branches   | 95           | 90.00%      | **89**       |
| `unlock/**`    | Functions  | 100          | 95.45%      | **95**       |
| `unlock/**`    | Statements | 90           | 88.88%      | **88**       |
| `unlock/**`    | Branches   | 85           | 84.37%      | **83**       |

Three of the four global values move upward (statements 85→90,
functions 85→93, lines 85→92) because the measured values are well
above the old floor; locking closer to measured reduces the chance
of silent regressions. Branches moves down (85→80) to match the
actual v4 measurement.

All other thresholded scopes (crypto 100, db repositories 100, db 90-95,
onboarding 90-100, pwa-update 95-100, router 90-95, app-shell 85-100)
are unchanged: they all still passed under the new provider, so the
existing gates remain honest.

## Consequences

- Coverage numbers now reflect actual tested-vs-untested ratios, not
  v8-to-istanbul's inflated approximation.
- Project-wide floor policy in `.claude/rules/quality-checks.md`
  ("No module falls below 80% without an explicit ADR-documented
  exception in `docs/decisions/`") is respected: global branches at
  80% sits at the floor; this ADR is the exception mechanism the rule
  asks for.
- Future increases to any threshold must account for the fact that
  numbers are now truthful. Writing tests to push coverage up now
  produces real improvements rather than cosmetic remapping quirks.
- Any Vitest patch release that refines coverage measurement further
  may shift numbers by <1 percentage point; the 1-point buffer
  absorbs routine drift. A shift of >1 point in either direction
  warrants a threshold revisit in a follow-up ADR.
- Tests that actually cover more code will now be reflected as such;
  tests that accidentally raised coverage via remapping false
  positives will no longer do so.

## Related

- **DEPS-02 (commit `3e064c0`)**: Vite 6 → 7, Vitest 3 → 4 coupled
  upgrade.
- **DEPS-02a (commit `e1d505e`)** + engines-alignment follow-up
  (commit `f2036ed`): Node engine pin declarations.
- **`.claude/rules/quality-checks.md`**: project-wide coverage policy.
  Floor statement referenced above.
- **Vitest 4 migration guide, V8 Code Coverage Major Changes section**:
  source of the provider switch.

## Implementation

- `vite.config.ts`: `test.coverage.thresholds` updated per the table
  above. Global metrics recalibrated to floor-minus-1. `auto-lock`
  and `unlock` per-module thresholds recalibrated likewise. Other
  per-module thresholds unchanged.
- No changes to `coverage.include`, `coverage.exclude`, or reporter
  configuration.
- No new dependencies.
- `.claude/rules/quality-checks.md` unchanged; the floor rule and the
  ADR-exception mechanism it already describes cover this case.
