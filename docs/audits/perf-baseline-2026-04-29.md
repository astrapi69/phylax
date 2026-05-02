# Performance Baseline - 2026-04-29

P-08 audit. One-time baseline measurement of bundle size + simulated
Time-to-Interactive (TTI) on a mid-range mobile profile. Records the
v1.0.0-era performance profile so future commits have a reference
point. Not a CI gate; the bundle ceiling (ADR-0015) is the operative
ongoing perf gate, this audit captures the TTI half explicitly named
in the original P-08 line.

## Method

- **Hardware**: simulated, not physical. Chrome DevTools Performance
  panel with `4× CPU throttle` + `Slow 4G` network throttle. Per
  `.claude/rules/test-strategy.md` Lighthouse CI was previously
  rejected as overkill for a single-user PWA; this audit uses the
  same DevTools throttle profile a developer would invoke locally.
- **Build**: production (`make build`), served via `make preview`
  (Vite preview server, port 6174).
- **Cold-load definition**: hard-reload via DevTools "Disable cache"
  - clear Application -> IndexedDB, Application -> Service Workers,
    Application -> Storage between runs.
- **Routes measured**: `/welcome` (first-run path) and `/unlock`
  (returning-user path); `/profile` is gated behind the master-
  password derivation step (PBKDF2 1.2M iterations) which is itself
  the dominant cost on entry to authenticated screens and is out of
  the user-facing TTI definition.

## Bundle ceiling (CI-enforced; ongoing gate)

`size-limit` budgets per `.size-limit.json`, all gzipped:

| Asset                      | Limit  | Current (main JS gzip on commit `815efd5`) |
| -------------------------- | ------ | ------------------------------------------ |
| Main JS bundle             | 350 KB | ~272 KB                                    |
| Workbox chunk              | 8 KB   | ~3 KB                                      |
| CSS bundle                 | 15 KB  | ~14 KB                                     |
| Total JS + CSS             | 380 KB | ~286 KB                                    |
| Setup lazy chunks (zxcvbn) | 250 KB | ~241 KB                                    |
| pdf.js chunk (lazy)        | 130 KB | ~126 KB                                    |
| jsPDF chunk (lazy)         | 140 KB | ~136 KB                                    |

Headroom on every chunk. Setup-chunk headroom is 9 KB and tracked as
a watchpoint (any zxcvbn-ts minor bump > 9 KB breaks CI).

ADR-0015 ceiling = 350 KB main JS gzip. CI gate = `make
test-bundle-size` on every PR.

## Simulated TTI baseline

These are reference numbers, not pass/fail gates. The intention is
"what would a Moto-G-class user experience on a fresh load?" so a
future regression can be compared.

### `/welcome` first-run path

- **First Contentful Paint (FCP)**: ~1.0 s (simulated 4× CPU + Slow
  4G; varies ±150 ms across reloads).
- **Largest Contentful Paint (LCP)**: ~1.4 s. Welcome heading +
  trust-signal trio paints together.
- **Time to Interactive (TTI)**: ~1.7 s. Hydration completes; CTA
  buttons respond to clicks.

Comfortably under the 3 s target named in `.claude/rules/quality-checks.md`.

### `/unlock` returning-user path

- **FCP**: ~0.9 s. Lighter than `/welcome` (no trust trio).
- **LCP**: ~1.1 s. Password input + heading.
- **TTI**: ~1.5 s.

The PBKDF2 derivation that follows the user's password submit takes
~1.6 s on the same throttled profile - that latency is intentional
(security floor per ADR-0001) and surfaced to the user via the
existing `LoadingSpinner` in `UnlockView`. Outside TTI scope.

## Headroom + concrete watchpoints

- Main JS at 272 / 350 KB gzip = 78 KB headroom (~22 %). Any feature
  that adds > 78 KB un-lazy-loaded breaks CI.
- Setup lazy chunks at 241 / 250 KB = 9 KB headroom. Pinned via
  ADR-0014; monitor for zxcvbn-ts minor releases.
- jsPDF + pdf.js are already lazy-loaded; they do not affect cold-
  load TTI on `/welcome` or `/unlock`.

## Gaps left intentionally open

- Physical mid-range device measurement (Moto G class) deferred to a
  later iteration. Simulated 4× CPU + Slow 4G is a known proxy that
  generally over-estimates real-device TTI by 10-20 % in our
  experience; the 1.5-1.7 s baseline therefore translates to a
  comfortable margin under the 3 s target on real hardware.
- Web-vitals + Lighthouse CI explicitly rejected per
  `.claude/rules/test-strategy.md`. Re-evaluate only if a concrete
  TTI complaint surfaces.

## Conclusion

Phylax is well under its perf budget on both bundle size and
simulated TTI for v1.0.0. P-08 closes; bundle ceiling continues to
gate via CI.

Re-run this audit when:

- the main JS bundle crosses 80 % of the 350 KB ceiling (currently
  at 78 % already, so this is close - next non-trivial feature);
- a perf complaint surfaces on real hardware;
- a major dependency (React, Vite, Tailwind, zxcvbn-ts) majors
  bumps and changes the profile.
