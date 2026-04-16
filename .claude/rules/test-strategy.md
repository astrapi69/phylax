# Test Strategy

## Required per Feature Task

Every feature task (V-xx, IM-xx, E-xx, etc.) must include:

- **Unit tests** (Vitest): isolated tests per module/function/component
- **Component integration tests** (React Testing Library): component with direct dependencies
- **Bundle-size check**: automatic via CI gate (size-limit, configured in T-03, ADR-0010)
- **Smoke + accessibility**: automatic via production E2E suite (axe-core, configured in T-02)

## Conditionally Required

- **E2E tests** (Playwright): only when the feature spans a multi-screen flow or affects a critical user journey. Single-screen read-only views do not need dedicated E2E tests.
- **Vitest benchmarks**: only for identified performance hotspots. Current hotspot candidates: decrypt-heavy list views (50+ encrypted entities), Markdown rendering of large content, import of large profiles.

## Nightly (Not Per Commit)

- **Mutation tests** (Stryker): runs nightly on main via GitHub Actions cron. Per-module thresholds enforced independently. Not a per-commit gate due to runtime (~23 min combined). See ADR-0011 for strategy details.

## Not Standard

- Lighthouse CI (overkill for single-user PWA)
- Memory leak profiling (only when a concrete problem is reported)
- Visual regression / screenshot tests (maintenance cost exceeds value for single-developer project)

## Test Philosophy

- Tests serve the developer, not the other way around.
- Prefer behavior tests over structure tests. A test that breaks because you renamed a CSS class is structure-coupled.
- Coverage without mutation score is optimistic. Pursue killed mutants, not line numbers. 14 real behavioral gaps were found by mutation testing behind 95%+ line coverage (T-04 series).
- If test setup takes longer than the feature itself, the component is too complex to test. Refactor the component first.
- Brittle tests (failing on every UI refactor without catching real bugs) are liabilities. Delete or rewrite them.
- Sort-order tests must use relational assertions and enough entries to defeat random primary-key ordering in fake-indexeddb. Three entries can accidentally match; six entries have ~0.14% false-pass probability (T-04e lesson).
