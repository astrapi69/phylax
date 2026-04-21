# ADR-0013: Bundle Size Budget v3

> **Status**: main-JS and total-JS+CSS budgets **superseded by
> [ADR-0015](ADR-0015-bundle-budget-expansion.md)** (2026-04-21).
> Workbox chunk and CSS bundle budgets from this ADR **remain in
> effect**. Setup-chunk budget is governed by ADR-0014. This document
> is preserved as the historical record of the original
> tight-budget intent.

## Context

ADR-0012 raised per-chunk bundle budgets to 200 KB main JS / 220 KB
total. Those budgets were calibrated to absorb X-01 (markdown export)
and I18N-01 (i18next infrastructure + German extraction) with room to
spare. Reality after I18N-01a through I18N-01c:

- Main JS now measures 198.86 KB gzipped (1.14 KB headroom)
- Total JS+CSS 209.57 KB (10.43 KB headroom)

Remaining Phase 5 and I18N work alone exceeds the current cap:

- I18N-01d through I18N-01n: 12 more feature extractions. Each adds
  ~0.3 to 0.8 KB of JSON. Total ~5 to 8 KB.
- I18N-02 English translations: a second language doubles JSON
  (compression helps, so net ~5 to 10 KB).
- X-02 PDF export via `jsPDF`: the library weighs in around 35-40 KB
  gzipped after tree-shaking. Known before it lands; ADR-0012 flagged
  it.
- X-06 CSV export: negligible (~0.3 KB).
- X-03 date range, X-04 theme filter: small (~1-2 KB each).

Projected total with Phase 5 and full I18N: 260-285 KB main JS, plus
CSS growth for new UI. The ADR-0010-era 250 KB project-wide ceiling
starts to bind.

The ceiling is not a hard physical constraint; it was chosen to keep
Phylax installable on metered mobile connections. At 250 KB gzipped
over a slow 3G (50 kbps effective), the initial download is ~40
seconds. At 300 KB the same download is ~48 seconds: noticeably
slower, but still within PWA install expectations, especially because
the service worker caches the bundle after first visit and offline
mode eliminates re-downloads.

Three options:

- **Option A (incremental bumps)**: raise 200 to 230 for X-02, then to
  260 for I18N-02, then to 280 for future work. Three ADRs, three
  round trips. Administrative overhead without signal gain.
- **Option B (one structural bump)**: set budgets now that absorb all
  known planned work plus a reasonable growth buffer. The quality
  gate keeps fires on unexpected bloat; planned work lands without
  process friction. Same philosophy as ADR-0012, applied proactively.
- **Option C (remove the gate)**: delete `size-limit`. Loses the
  bundle-awareness signal entirely. Rejected.

## Decision

Adopt Option B. Update `.size-limit.json` per-chunk budgets and raise
the project-wide ceiling in quality-checks.md. Numbers below.

| Chunk                | ADR-0010 | ADR-0012 | ADR-0013   |
| -------------------- | -------- | -------- | ---------- |
| Main JS bundle       | 180 KB   | 200 KB   | **250 KB** |
| Workbox chunk        | 5 KB     | 5 KB     | **8 KB**   |
| CSS bundle           | 10 KB    | 10 KB    | **15 KB**  |
| Total JS + CSS       | 190 KB   | 220 KB   | **280 KB** |
| Project-wide ceiling | 250 KB   | 250 KB   | **300 KB** |

Workbox and CSS bumps are preemptive: Workbox grows with precache
manifest size (more asset-dependent features = larger precache list);
CSS grows with every new feature that adds Tailwind utility classes
not already used elsewhere. Both bumps leave comfortable headroom
without being aspirational.

The project-wide ceiling moves from 250 to 300 KB. Above 300 KB,
code-splitting becomes mandatory before further feature growth. That
remains a hard check point.

## Consequences

- Headroom after the bump: main JS 51.14 KB, total 70.43 KB, ceiling
  buffer 101 KB. Phase 5 (X-02 + filters) + I18N-02 fit comfortably.
- CI `make test-bundle-size` stays a meaningful quality gate. Today's
  footprint (198.86 / 250) means the check will light up if an
  unplanned feature adds double-digit KB.
- ADR-0012's "200 KB is sized so trimming is an option, not a
  necessity" framing continues: 250 KB is likewise sized to absorb
  known work. Unplanned bloat still surfaces.
- Future dependency rule remains in force: no new runtime dependency
  > 10 KB gzipped without an ADR. That discipline is about awareness,
  > not about the exact budget number.
- The 300 KB absolute ceiling still represents the point where
  code-splitting is mandatory. At projected v1.2 or v1.3 feature
  maturity, that point may arrive; this ADR does not remove the
  check, only postpones it.

## Alternatives considered

- **Incremental bumps per ADR-0012 precedent**: rejected. Each bump
  requires an ADR, commit cycle, and review. The signal benefit is
  zero if the end state is the same as Option B.
- **Larger structural bump (400 KB main)**: rejected. Too loose;
  future-us loses the signal that bundle growth matters.
- **Gate removal**: rejected. The gate catches unexpected regressions,
  which is its core value.
- **Aggressive trim before budget bump**: rejected for X-01 polish
  commit already. The project design favors clarity over byte-shaving
  where budget allows.

## Implementation

- `.size-limit.json`: update the four `limit` values.
- `.claude/rules/quality-checks.md`: update the "Performance budget"
  section's first bullet with the new ceiling and ADR reference.
