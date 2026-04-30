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

## Manual Smoke (Repo Artifact)

Some feature behavior cannot be asserted by Vitest or Playwright:
subjective UX (cramped spacing at 360px, ugly wrap), real-browser-only
behavior (service worker activation across tabs, IndexedDB eviction
under storage pressure), multi-device verification, screen-reader
walks, real-network checks. These ship as a smoke file in
`docs/manual-smoke/`.

### When to add a smoke file

A feature commit ships a smoke file when:
- New UI surface needs visual fit / hit-target verification
- PWA / Service Worker / install / update flow changes
- Cross-feature refactor with regression risk beyond the unit layer
- A11y dimension automated axe cannot reach (SR semantics, focus
  flow across modals, reduced-motion)
- Real-network or multi-device behavior

Do NOT add a smoke file when Vitest or Playwright can assert the
behavior. Automation first; manual smoke fills the gap, not the
default.

### File convention

Path: `docs/manual-smoke/<task-id>-<short-description>.md` -
example: `docs/manual-smoke/p-01-mobile-sweep.md`. Skeleton and
workflow live in `docs/manual-smoke/README.md` (single source of
truth for the convention).

Investigation artifacts (audit reports, gap analyses) live in
`docs/audits/`. Execution artifacts (smoke walk-throughs with
sign-off) live in `docs/manual-smoke/`. Two directories, two
purposes; do not collapse.

The post-crypto-change ad-hoc smoke described in
`quality-checks.md` is a different artifact - it is a developer
discipline check after touching the crypto / lock / storage layer,
not a per-feature deliverable. Both patterns coexist.

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
