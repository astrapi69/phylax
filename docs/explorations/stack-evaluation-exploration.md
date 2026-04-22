# Stack Evaluation for PWA Context

**Date**: 2026-04-22
**Purpose**: Honest assessment of whether the current Phylax dependency choices are optimal for a privacy-first PWA. Identifies where the stack is best-in-class, where it is pragmatic-but-not-optimal, and where alternatives might warrant consideration.

Not an actionable task. Companion to `dependency-status-2026-04-22.md`.

---

## What a PWA technically requires

Core PWA elements:

- Service Worker (offline, caching, background sync)
- Web App Manifest (installation, app icon, display mode)
- HTTPS delivery
- Responsive design

Everything else is application-level decision, not PWA-specific requirement.

## What Phylax needs on top

- Local-first (no cloud)
- Zero-knowledge E2E encryption (AES-GCM, PBKDF2)
- Client-side persistent storage (IndexedDB)
- Bilingual UI (DE/EN, planned: Greek, French, Spanish)
- Medical data management workflows

Stack must deliver: PWA + local-first + crypto + storage + UI.

---

## Per-bucket evaluation

### Framework: React 19

**Appropriate.** React for a single-page app is the mainstream choice. No structural problems for PWA usage.

**Alternatives that exist:**

- **Svelte/SvelteKit**: smaller bundles (10-20% less), faster runtime. But: team-skill dependency, smaller ecosystem
- **SolidJS**: similar philosophy, very small. Even smaller ecosystem, riskier for long-lived project
- **Vue 3**: similar trade-offs to React
- **Preact**: React-compatible, 3 KB runtime instead of 45 KB. Very attractive for PWAs

**Preact is the obvious candidate not chosen.** Preact with `preact/compat` is essentially a drop-in replacement for React in many projects, yielding ~40 KB bundle savings. For a PWA where bundle size matters, this is material.

**But**: Phylax is already on React 19 with substantial tooling. Switch would be a large migration. Pragmatically: stay on React.

### Build: Vite + vite-plugin-pwa

**Excellent.** Vite is currently best-in-class for modern web apps. `vite-plugin-pwa` is the de-facto standard for PWA integration with Vite, wrapping Workbox, auto-update strategy, manifest generation.

No better alternative for this use case. Optimal.

### Testing: Vitest + Playwright + Testing Library

**Excellent.** Vitest is Vite-native, fast, Jest-compatible. Playwright for E2E is the industry standard in 2026 (beats Cypress in most benchmarks). Testing Library for component tests is correct.

No better alternative. Optimal.

### Storage: Dexie.js (IndexedDB wrapper)

**Excellent.** Dexie is the de-facto standard for IndexedDB abstraction.

**Alternatives:**

- **idb** (Jake Archibald): lower level, less abstraction. More code, but more control
- **rxdb**: reactive, observable-based, with sync features. Overkill for single-device local-first
- **localforage**: older, less maintained
- **LocalFirst/OPFS**: bleeding-edge File System Access API instead of IndexedDB. Better performance, worse browser support

Dexie is the right choice. Battle-tested, well-maintained, TypeScript-first.

### Crypto: Web Crypto API direct

**Correct.** Using Web Crypto API natively is right for zero-knowledge apps. No library dependency, no bundle overhead, browser-implemented and seriously audited.

Alternatives would be `tweetnacl`, `libsodium-wrappers`, `sjcl` - but Web Crypto is more native and better. Optimal.

### Password Strength: zxcvbn-ts

**Okay but debatable.** zxcvbn is the classic choice for password strength estimation. But:

- Setup chunk would be massive with language packs (~931 KB)
- Phylax uses only `core + language-common` (~240 KB) per ADR-0014, making strength check weaker
- Alternative: no strength library at all, only length + complexity rules as client-side check

For a single-user-on-device password, dictionary-attack-resistance estimation is not really needed. The password only protects locally against "someone grabs your unlocked device" - not against remote attacks. Password strength meter is a UX feature, not a security feature.

**Could have been omitted.** But now that it is in, ADR-0014's decision (dropping language packs) is the right balance.

### i18n: i18next + react-i18next

**Okay, slightly overkill.** i18next is extremely featureful - pluralization, interpolation, namespaces, language detection, fallback chains, etc. For a bilingual app with 22 namespaces, this is justified.

**Alternatives:**

- **react-intl** (FormatJS): similarly featureful, ICU MessageFormat based. Stronger in CLDR integration
- **lingui**: more compact, build-time extraction
- **custom minimal solution**: with 2 languages, theoretically possible in ~50 lines of code

With 22 namespaces and planned additional languages (Greek, French, Spanish), i18next is correct. Optimal at this scale.

### UI/Styling: Tailwind CSS

**Okay, significant trade-off.** Tailwind is immensely popular and productive. But:

- Bundle cost is real: every utility class string in HTML
- Tailwind 3 config is JS-based, Tailwind 4 is CSS-first (better)
- Dark mode, responsive, theming work well

**Alternatives:**

- **CSS Modules**: scoped CSS, no framework dependency. More code, more control
- **Vanilla Extract**: type-safe CSS, zero-runtime. Modern contender
- **Panda CSS**: Tailwind-like but type-safe, zero-runtime
- **UnoCSS**: Tailwind-compatible but atomic, smaller

Tailwind is pragmatically right. Not the smallest bundle option, but productivity/time-to-ship is good. For a solo-dev project, it fits.

### Router: react-router-dom v7

**Okay, over-featured.** React Router v7 is massive - full data router features, loaders, actions, suspense, error boundaries. Phylax uses (per TD-05 investigation) only the legacy API (BrowserRouter + Routes+Route), not data router features.

**Alternatives:**

- **@tanstack/router**: type-safe, performant, modern. Smaller bundles
- **wouter**: 1.6 KB tiny router for React. No data features but irrelevant for Phylax

**Wouter would actually be more optimal for Phylax's usage pattern.** Only routing and navigation is used, no data loading features. react-router-dom v7 is overhead. Switching to wouter would save ~15-20 KB of bundle.

But: migration work, and react-router-dom works.

---

## Overall assessment

**Stack is good, not perfect.** No bad decisions, but two bundle optimization opportunities exist:

1. **React -> Preact/compat**: ~40 KB savings (likely)
2. **react-router-dom -> wouter**: ~15-20 KB savings (likely)

Both together: ~55-60 KB potential bundle reduction. At current 231 KB main JS, that would be 25% smaller.

### What is optimal

- Vite + vite-plugin-pwa
- Vitest + Playwright + Testing Library
- Dexie.js
- Web Crypto API native
- i18next (at planned multi-language scope)

### What is debatable

- React (vs Preact for bundle size)
- Tailwind (vs UnoCSS/Vanilla Extract for bundle size)
- react-router-dom (vs wouter for bundle size)
- zxcvbn-ts (vs nothing - is the feature actually valuable?)

---

## PWA-specific gap analysis

What is missing or debatable from a PWA-specific standpoint.

### Missing: direct Workbox access

`vite-plugin-pwa` wraps Workbox but exposes it only partially. For complex caching strategies (stale-while-revalidate for API responses, cache-first for assets), direct Workbox config is needed. Phylax likely has default strategy - okay for simple PWAs, but customization is limited.

### Missing: IDB + OPFS dual strategy

Modern PWAs can use Origin Private File System (OPFS) for better performance and no storage quota issues. IndexedDB is okay but OPFS is faster and more reliable. Not critical but future-forward.

### Missing: Background Sync / Periodic Sync APIs

If Phylax ever needs "sync when back online" features - Service Worker Background Sync API is not available out-of-the-box. vite-plugin-pwa does not help here. Manual in service worker code.

### Missing: Share Target / File Handler APIs

A PWA can register as a share target (user shares content to Phylax from another app). Makes sense for a medical-data app (e.g., "share lab PDF to Phylax"). Would be defined in manifest, then service worker handles the event.

### Present: Web Crypto, IndexedDB, Manifest, Service Worker

The core PWA features are all in place.

---

## Recommendation

**For now: change nothing.** The stack is pragmatically correct, not bundle-optimal. Switches are expensive (migration work).

**For Phase 9+ (if ever prioritized):**

Bundle optimization track could make sense when/if hitting the 350 KB budget:

1. react-router-dom -> wouter (easy)
2. React -> Preact/compat (medium effort)
3. Tailwind 4 migration (coming anyway, new engine is faster)

Or: bundle limit irrelevant, focus on features.

**For next features that would be strategically relevant:**

1. **OPFS integration** if large files get stored (documents, images)
2. **Share Target** if user workflow "import via share" fits (likely yes for medical app)
3. **Workbox direct** if complex caching strategies become necessary

But these are feature decisions, not stack decisions.

---

## Summary

Stack is good, not optimal. No acute switch recommendations.

The current choices reflect sensible pragmatic trade-offs for a solo-dev long-lived project. Where better alternatives exist, the gap is bundle size, not functionality. Bundle size matters for PWAs (install-time download, mobile bandwidth), but ADR-0015 raised the budget to 350 KB and accepted eager locale loading, so bundle pressure is not currently binding.

If Phylax's main bottleneck ever becomes bundle size or installation performance, Preact/compat + wouter would be the two lowest-risk-highest-value swaps.

---

## Sources

Based on April 2026 state of the ecosystem. Benchmarks and version numbers as of this exploration date.

- React alternatives: npm trends comparison, bundle-size analysis via Bundlephobia
- PWA tooling: vite-plugin-pwa docs, Workbox docs
- Router comparison: wouter GitHub, @tanstack/router docs
- CSS framework comparison: Tailwind 4.0 blog, UnoCSS docs, Vanilla Extract docs
- Storage: Dexie documentation, OPFS spec at web.dev
