# ADR-0012: Bundle Size Budget v2

## Context

ADR-0010 set per-chunk bundle budgets (main JS 180 KB gzipped, CSS
10 KB, Workbox chunk 5 KB, total JS+CSS 190 KB). Those numbers were
calibrated against the Phase 1 + Phase 2 feature set and offered
roughly 30 KB headroom at the time.

Between ADR-0010 and now the app gained:

- AI-series (AI-01 through AI-11): Anthropic integration, chat UI,
  streaming, commit preview, guided session, parser fallback
- S-series (S-01 through S-03): donation integration (onboarding card,
  reminder banner, settings section)
- V-series (V-01 through V-06, V-02b): read-only views for every
  entity type plus sort-enhancement
- I-04: privacy disclosure precision (PrivacyInfoPopover + enriched
  disclaimer)
- R-01: full PWA icon set + enriched manifest
- X-01: Markdown export (~3.3 KB gzipped added: pure export function,
  download helper, useExportData hook, ExportDialog, ExportButton)

The current main JS is 181.31 KB gzipped and total 192.02 KB, both
narrowly over the ADR-0010 cap with X-01 included.

Phase 5 and the I18N refactor add known further weight:

- I18N-01 (i18next + react-i18next + browser-languagedetector): ~15 to
  20 KB gzipped estimated
- X-02 (jsPDF for PDF export): ~30 to 40 KB gzipped estimated
- X-06 (CSV export helpers): negligible

Projected Phase 5 + I18N footprint: 235 to 255 KB gzipped main JS,
260 to 280 KB total. The project-wide hard ceiling in
quality-checks.md is 250 KB for main JS; the per-chunk budgets are the
operative CI gate, not the ceiling.

Option A (incremental bumps): raise 180 to 185 now for X-01, then to
200 for I18N-01, then to 235 for X-02. Three ADRs, three history
entries, three short runways.

Option B (one bump to projected realistic ceiling): set budgets now
that absorb all planned Phase 5 + I18N work with sane headroom, so the
gate fires only on unexpected bloat.

Option C (raise quality-checks.md ceiling to 300 KB): loosens the
project-wide cap. Not recommended; 250 KB is the mobile-PWA
performance budget target and changing it needs a separate discussion.

## Decision

Adopt Option B. Update `.size-limit.json`:

| Chunk          | Old    | New               |
| -------------- | ------ | ----------------- |
| Main JS bundle | 180 KB | 200 KB            |
| Workbox chunk  | 5 KB   | 5 KB (unchanged)  |
| CSS bundle     | 10 KB  | 10 KB (unchanged) |
| Total JS + CSS | 190 KB | 220 KB            |

Project-wide ceiling in quality-checks.md (250 KB main JS) stays
unchanged. The 200 KB per-chunk budget is 50 KB below that ceiling,
leaving buffer for jsPDF (X-02) and any late-stage additions.

Budget philosophy: the gate should catch unexpected bloat, not block
legitimate feature growth. A budget that requires raising every time
a planned feature lands provides no signal.

## Consequences

- X-01 lands cleanly at 181.31 / 192.02 KB with 18.69 / 27.98 KB
  headroom. CI gate stays green through X-02 and I18N-01 absent
  regressions.
- Future features that push past 200 / 220 KB still surface as CI
  failures, preserving the original ADR-0010 feedback loop.
- If X-02 (jsPDF) lands and pushes main JS beyond 200 KB, we either
  trim (e.g., tree-shake unused jsPDF modules) or revisit this ADR.
  200 KB is sized so trimming is an option, not a necessity, on a
  typical X-02 implementation.
- Project-wide 250 KB ceiling in quality-checks.md remains the
  absolute cap. At 250 KB, code-splitting becomes mandatory before
  further feature growth.
- No change to ADR-0010's tool choice, CI wiring, or baseline
  recording mechanism. Only the numeric budgets move.

## Alternatives considered

- **Option A (three incremental bumps)**: rejected. Administrative
  overhead of three ADRs, three `.size-limit.json` changes, three
  review cycles; no signal benefit over Option B.
- **Option C (raise hard ceiling)**: rejected. The 250 KB ceiling is
  a performance target, not a red-tape limit. Keep it in place.
- **Trim X-01 under 180 KB**: rejected on review. X-01 delivers
  round-trip-verified export; the pure-function + hook + dialog split
  is the correct pattern for X-02/X-06/X-07 reuse and should not be
  inlined to save bytes.
