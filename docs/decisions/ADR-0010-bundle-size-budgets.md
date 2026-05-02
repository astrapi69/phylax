# ADR-0010: Bundle Size Budgets

**Date:** 2026-04-15
**Status:** Accepted

## Context

Phylax is a PWA targeting mobile users on potentially slow or metered
connections. The quality checks rule (`.claude/rules/quality-checks.md`)
sets a hard ceiling of 250 KB gzipped for the initial JS bundle. Without
a per-commit gate, drift toward that ceiling goes unnoticed until it is
too late to cheaply reverse.

A prior bash-based bundle check existed in `.github/workflows/ci.yml`
(job `Build & Bundle Check`). It summed `gzip -c | wc -c` for all
`dist/assets/*.js`, compared to a 150 KB ceiling, and exited non-zero on
overshoot. It worked correctly. What failed was **observation**: the
check began failing at T-01a when the theme work pushed gzipped JS
above 150 KB, and it kept failing through every subsequent commit
(T-01b, T-02a, T-02b, V-01, V-02). The job failure cascaded to
`E2E (Production)` being skipped (it declares `needs: build`). The team
relied on local verification and did not watch CI status, so the gate
was effectively inert.

The root cause is therefore not a logic bug but a feedback-loop bug:
a correctly-failing check with no consequences is the same as no check.
Fixing it requires better tooling (clearer output, per-asset budgets,
a baseline recorded in the repo rather than as an inline literal) and
budgets that are realistic enough that green is the normal state and
red demands attention.

## Decision

Adopt `size-limit` with `@size-limit/preset-app` as dev dependencies.
Configure per-asset gzipped budgets in `.size-limit.json`. Run via
`make test-bundle-size` locally, via `npm run size` in CI, and wire
into `make ci-local-full`.

### Tool choice

- **`size-limit`**: active, widely used, supports glob paths against
  prebuilt artifacts, emits per-entry pass/fail with headroom shown.
  Gzipped measurement is the default. Works against any bundler's
  output, so Vite specifically is fine.
- Rejected: `bundlesize` (unmaintained, last release predates
  Node 18). `webpack-bundle-analyzer` is an interactive visualizer,
  not a CI gate, and is webpack-specific.
- The `@size-limit/preset-app` preset includes the headless Chrome
  runner; we disable JS execution timing (`running: false`) because
  runtime performance is out of scope for T-03. Size is measured from
  the built artifacts on disk regardless.

### Measured baseline (2026-04-15, commit 615de8f after V-02)

| Asset                              | Raw       | Gzipped (`gzip -c \| wc -c`) | Gzipped (size-limit) |
| ---------------------------------- | --------- | ---------------------------- | -------------------- |
| `dist/assets/index-*.js` (main JS) | 487,569 B | 152,873 B (149.3 KB)         | 152.59 KB            |
| `dist/assets/workbox-*.js`         | 5,761 B   | 2,406 B (2.35 KB)            | 2.37 KB              |
| `dist/assets/index-*.css`          | 44,560 B  | 7,192 B (7.0 KB)             | 7.09 KB              |
| **Total JS + CSS**                 |           | **162,471 B (158.7 KB)**     | **162.05 KB**        |

The two measurement methods differ by roughly 2-3% for the main JS
chunk. We track size-limit's numbers because that is the enforcing
tool; the raw-gzip numbers are recorded here for historical cross-check.

### Initial budgets

Per-entry, based on measured + ~20% headroom, rounded:

| Entry          | Measured (size-limit) | Budget     | Headroom |
| -------------- | --------------------- | ---------- | -------- |
| Main JS bundle | 152.59 KB             | **180 KB** | 27.4 KB  |
| Workbox chunk  | 2.37 KB               | **5 KB**   | 2.6 KB   |
| CSS bundle     | 7.09 KB               | **10 KB**  | 2.9 KB   |
| Total JS + CSS | 162.05 KB             | **190 KB** | 27.9 KB  |

Workbox uses an absolute-rounded budget rather than percentage headroom:
it is a small vendor-controlled chunk (vite-plugin-pwa) where 20% of a
small number is not a meaningful tolerance.

The total budget is held below the 250 KB initial-JS ceiling from
`.claude/rules/quality-checks.md` with material margin.

## Consequences

### Positive

- Every commit is gated on bundle size in CI. A regression surfaces as
  a failing job with a line item identifying which asset broke.
- Budgets live in `.size-limit.json` in the repo, not as an inline bash
  literal. PR diffs show budget changes explicitly.
- Per-asset budgets catch regressions that a single-total budget hides
  (e.g., CSS ballooning while JS shrinks nets zero on the total).

### Negative

- One more dev dependency to maintain (size-limit plus the preset). No
  runtime impact.
- `make test-bundle-size` runs the production build, adding ~2 seconds
  to `ci-local-full`. Acceptable.

### When to update budgets

Budgets move when a deliberate, reviewed dependency addition or
feature lands that justifies the growth (e.g., ADR-0008 added
`react-markdown`, which moved the main JS chunk meaningfully). The
update is made in the same PR that introduces the growth, with the
new baseline documented in the commit message. Unjustified growth
"because the number needs to be bigger" is not acceptable; in that
case, profile and trim.

The baseline table in this ADR is not rewritten on every bump. It
records the state at T-03's introduction. Future ADRs that move the
ceiling (or bump individual budgets significantly) cite back to this
baseline for comparison.

### When the budget starts to bind

When the total approaches 220-230 KB (well before the 250 KB hard
ceiling), open a code-splitting or route-splitting task rather than
raising the budget further. Bundle size is not a single-axis problem
past that point.
