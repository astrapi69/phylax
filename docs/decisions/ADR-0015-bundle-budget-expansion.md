# ADR-0015: Bundle Budget Expansion for Multilingual Support

**Date:** 2026-04-21
**Status:** Accepted
**Supersedes:** [ADR-0013](ADR-0013-bundle-size-budget-v3.md) (main JS + total JS+CSS budgets only; Workbox-chunk and CSS-bundle budgets from ADR-0013 remain in force)

## Context

ADR-0013 set the main-JS gzipped budget at 250 KB with a 300 KB
absolute project ceiling. That budget was calibrated for a
single-language (German) app with room to absorb Phase 5 (X-01, X-02
PDF export) plus the original I18N-01/02 scope.

Reality after I18N-02-e (English go-live, commit `8301afd`):

- Main JS: 231.44 KB gzipped (18.56 KB headroom against the 250 KB cap)
- Total JS + CSS: 242.3 KB (37.7 KB headroom against 280 KB)
- Setup lazy chunks (zxcvbn-ts): 240.96 KB unchanged

The I18N-02-e commit grew main by +15.29 KB, substantially more than
the projected +1.5 KB. Investigation identified Vite's default
chunking strategy: all locale JSONs are statically imported into the
main bundle, so adding English as a live language inlined ~13 KB of
additional JSON + the detector logic. Previously the EN resources
were statically bundled but unused; the switch from `lng: 'de'` to
`lng: detectInitialLanguage()` made both language paths hot, and
Vite adjusted chunking accordingly.

### Multilingual expansion projection

Phase P-11 and later plan additional languages:

- Greek (el): ~8-10 KB gzipped JSON after translation
- French (fr): ~8-10 KB
- Spanish (es): ~8-10 KB

Conservative projection with four additional languages: +32-40 KB
growth in main JS. Post-expansion main JS: 263-271 KB. The 250 KB
cap blocks all of this without architectural work.

### Options considered

- **Option A (keep 250 KB, lazy-load non-primary locales)**: requires
  restructuring i18n config to async-load locale bundles on demand.
  Adds loading state for non-DE users, asynchronous paths in the
  detector, and complexity for a currently-unconstrained problem.
  Workable but scope-creep; deferred as a future optimization if
  bundle pressure ever becomes genuinely binding.
- **Option B (intermediate bumps, e.g., 275 or 300 KB)**: insufficient
  headroom for planned multilingual expansion. Would trigger another
  budget-bump ADR within 1-2 feature cycles. Administrative overhead
  without signal gain; same argument ADR-0013 rejected against
  incremental bumps.
- **Option C (raise to 350 KB)**: one structural bump absorbs planned
  multilingual expansion plus a reasonable growth buffer. CI gate
  keeps firing on unexpected bloat; planned work lands without
  process friction.
- **Option D (remove the gate)**: loses the bundle-awareness signal
  entirely. Rejected.

## Decision

Adopt **Option C**: raise main JS gzipped budget to **350 KB**.
Accept the eager-loaded locale strategy. Defer lazy-loaded locales
as a future optimization.

Concrete changes:

| Chunk                        | ADR-0013 | ADR-0015   |
| ---------------------------- | -------- | ---------- |
| Main JS bundle               | 250 KB   | **350 KB** |
| Workbox chunk                | 8 KB     | unchanged  |
| CSS bundle                   | 15 KB    | unchanged  |
| Total JS + CSS               | 280 KB   | **380 KB** |
| Project-wide ceiling         | 300 KB   | **400 KB** |
| Setup lazy chunks (ADR-0014) | 250 KB   | unchanged  |

The project-wide ceiling moves from 300 to 400 KB. Above 400 KB,
code-splitting becomes mandatory before further feature growth.
That remains a hard check point.

## Consequences

- Main JS can grow up to 350 KB gzipped before CI fails. Current
  measurement: 231.44 KB leaves 118.56 KB headroom - sufficient for
  four additional languages (~32-40 KB), Phase 4 ePA-integration work
  (uncertain cost), and general feature growth.
- Less precise signal from size-limit CI for future bundle-growth
  regressions. The gate still catches large unexpected jumps; the
  headroom is what absorbs expected growth.
- First-paint on constrained networks: 350 KB takes roughly 3-4
  seconds over baseline 3G (~750 kbps effective), 5-7 seconds on
  throttled/slow 3G (~400 kbps). Service worker caches after first
  visit, so the penalty is first-install-only. Acceptable for a PWA
  where first install is a deliberate user action. The delta vs the
  prior 250 KB budget is roughly 1 second on baseline 3G and 2
  seconds on slow 3G.
- Unlocks multilingual expansion without architectural rework.
- If Phase 4 (ePA integration) or other features push toward 350 KB,
  optimization becomes necessary at that point. Lazy-loaded locales
  remain the most-compelling optimization when bundle pressure
  genuinely binds.

## Alternatives considered

Documented in Context above:

- Lazy-load non-primary locales: deferred as future optimization.
- Intermediate bump (275/300 KB): rejected; insufficient headroom.
- Gate removal: rejected; loses signal.
- Investigate + fix I18N-02-e growth specifically: technically
  reasonable but deprioritized per product decision. The growth was
  not a bug; it was a chunking-regression-as-designed consequence of
  activating a second live language.

## Related

- **ADR-0010, ADR-0012, ADR-0013**: prior budget decisions. Main-JS
  and Total budgets from ADR-0013 are superseded for those two
  metrics. Workbox, CSS, and setup-chunk budgets from those ADRs
  remain in effect.
- **ADR-0014**: zxcvbn-ts setup chunk budget (250 KB) unchanged.
- **Future ADR** if lazy-loaded locales or other bundle-structure
  changes are ever adopted.

## Implementation

- `.size-limit.json`: main JS 250 → 350 KB, Total JS+CSS 280 → 380 KB.
  Other entries unchanged.
- `.claude/rules/quality-checks.md`: "Performance budget" section
  updated to reference ADR-0015 and the new caps.
- ADR-0013 gets a header note referencing this ADR as the superseding
  decision for main JS + total JS+CSS.
- `docs/ROADMAP.md` P-08 performance audit entry updated to reference
  the 350 KB cap. New Tech Debt entry captures the deferred
  lazy-load-locales optimization handle.
