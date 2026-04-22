# Dependency Status Exploration

**Date**: 2026-04-22
**Purpose**: Snapshot of all dependencies in `package.json`, identification of major-version gaps, recommendation for future upgrade sequence.

Not an actionable task. Serves as reference when upgrade decisions come up.

---

## Current vs Latest

Based on npm registry check, April 2026.

### Current (caret ranges auto-catch minor updates)

| Package                     | `package.json` | Latest | Status                           |
| --------------------------- | -------------- | ------ | -------------------------------- |
| react                       | 19.2.5         | 19.2.5 | current (exact pin)              |
| react-dom                   | 19.2.5         | 19.2.5 | current (exact pin)              |
| @types/react                | ^19.2.14       | 19.2.x | current                          |
| @types/react-dom            | ^19.2.3        | 19.2.x | current                          |
| react-router-dom            | ^7.14.0        | 7.x    | current                          |
| @testing-library/react      | ^16.3.2        | 16.x   | current                          |
| @testing-library/user-event | ^14.6.1        | 14.x   | current                          |
| @testing-library/jest-dom   | ^6.9.1         | 6.x    | current                          |
| react-i18next               | ^17.0.4        | 17.x   | current                          |
| i18next                     | ^26.0.5        | 26.x   | current                          |
| @playwright/test            | ^1.59.1        | 1.x    | current                          |
| react-markdown              | ^9.1.0         | 9.x    | current                          |
| dexie                       | ^4.4.2         | 4.x    | current                          |
| @zxcvbn-ts/core             | 3.0.4          | 3.x    | current (exact pin per ADR-0014) |
| @zxcvbn-ts/language-common  | 3.0.4          | 3.x    | current (exact pin per ADR-0014) |

### Major updates available

| Package                 | Current | Latest    | Gap          |
| ----------------------- | ------- | --------- | ------------ |
| **vite**                | ^6.0.5  | **8.0.9** | **2 majors** |
| **vitest**              | ^3.2.4  | **4.1.4** | **1 major**  |
| **@vitest/coverage-v8** | ^3.2.4  | **4.1.4** | **1 major**  |
| **typescript**          | ^5.7.2  | **6.0.3** | **1 major**  |
| **tailwindcss**         | ^3.4.17 | **4.2.3** | **1 major**  |

---

## Major Upgrade Details

### Vite 6 -> 8 (released 2026-03-12)

**Largest migration on the list.**

Vite 8 switches from Rollup/esbuild to Rolldown+Oxc as core build tools. This is an architectural change, not just a performance bump.

**Breaking changes:**

- Plugin API may be incompatible (depending on plugin usage in Phylax)
- `optimizeDeps.esbuildOptions` deprecated in favor of `optimizeDeps.rolldownOptions`
- `build.rollupOptions.output.format: 'system'` and `'amd'` no longer supported
- Browser targets stricter: Baseline Widely Available as of 2026-01-01
- `parseAst` / `parseAstAsync` deprecated in favor of `parseSync` / `parse`

**Node requirement:** 20.19+ or 22.12+. No impact for Phylax (on 24).

**Compatibility:** `@vitejs/plugin-react ^4.3.4` must be checked for Vite 8 compatibility. `vite-plugin-pwa ^1.2.0` as well.

**Intermediate path:** `rolldown-vite@7.2.2` available as Vite-7-with-Rolldown, if migrating in two steps is preferred (Vite 6 -> Vite 7+Rolldown -> Vite 8). Probably not needed for Phylax, single-step Vite 6 -> 8 should work.

**Effort:** moderate to high. Depends on how many plugins Phylax actually uses and whether they are Vite-8 compatible.

### Vitest 3 -> 4 (released 2026-03-ish)

**Tightly coupled with Vite 8.**

Vitest 4.x supports Vite 6, 7, and 8. When Vite is upgraded, Vitest should follow. Can be upgraded standalone (Vitest 4 works with Vite 6), but then you miss Vite-8-specific Vitest 4 features.

**Breaking changes:**

- `vi.mock` or `vi.hoisted` declared outside top-level modules now log warnings
- `useId` prefix changed (affects React 19 users via `_r_` default)
- Async leak detection via `--detect-async-leaks` available

**Compatibility:** `@vitest/coverage-v8` must upgrade alongside to 4.x. `jsdom ^25.0.1` stays, `@vitest/ui` if used.

**Effort:** low if Phylax does not use Vitest deep internals. Moderate if test setup has custom matchers or hooks.

### TypeScript 5.7 -> 6.0 (released 2026-03-23)

**Bridge release before TypeScript 7 (Go port).**

TS 6 is explicitly the "last JavaScript-based version". TS 7 will be Go-native with multi-threading and ~10x performance gain. TS 6 is a low-friction migration that surfaces deprecations without forcing hard breaking changes.

**Breaking changes:**

- `strict: true` is now default (Phylax has this set already, likely)
- `target` default on ES2025
- `module` default on esnext
- `--stableTypeOrdering` flag for TS7 compatibility
- `--baseUrl` and `moduleResolution: node` deprecated
- Compiler less context-sensitive for functions without `this`

**Effort:** low to moderate. Well-typed codebases like Phylax likely need few fixes. `--deprecation` flag shows all problem spots before the bump.

**After TS6:** TS7 arrives Q4 2026 or 2027, brings massive performance but substantial breaking changes. TS6 is therefore actually a recommended intermediate step.

### Tailwind 3 -> 4 (released early 2025, currently 4.2.3)

**Largest conceptual migration.**

Tailwind 4 is a ground-up rewrite with the Oxide engine. Full rebuild 3.5x faster, incremental 8x faster. But: complete config paradigm shift.

**Breaking changes:**

- **No more `tailwind.config.js`.** Config is CSS-first via `@theme` directive
- Instead of `@tailwind base; @tailwind components; @tailwind utilities` -> `@import "tailwindcss"`
- New browser requirements: Safari 16.4+, Chrome 111+, Firefox 128+
- `@apply` has edge cases in component libraries that need fixing
- PostCSS plugin now `@tailwindcss/postcss` separately
- Dedicated `@tailwindcss/vite` plugin recommended over PostCSS pipeline

**Automated migration:** `npx @tailwindcss/upgrade` tool handles 80% of mechanical changes.

**Compatibility:** `prettier-plugin-tailwindcss ^0.6.11`, `@tailwindcss/typography ^0.5.19`, `autoprefixer ^10.4.20`, `postcss ^8.4.49` - all must be checked for Tailwind 4 compatible versions.

**Effort:** high. Config migration is mechanical, but `@apply` sites and custom component patterns need manual review. Phylax has 231 KB main JS with heavy Tailwind class usage - expect many review spots.

---

## Recommended Upgrade Sequence

**Not everything at once.** Each major upgrade is its own commit with its own risks.

### Proposed order (lowest risk first)

**1. TypeScript 5 -> 6** (separate task)

Bridge release is explicitly designed low-friction. With `--deprecation` flag before the bump, all warning spots can be identified ex-ante. Typecheck gets stricter through `strict: true` default, but Phylax has this already, presumably. Single commit `chore(deps): upgrade TypeScript to 6.0`.

**Risk:** low. TS team explicitly prioritized backward compatibility.
**Effort:** 1-2h.
**Gate:** typecheck, lint.

**2. Vite 6 -> 8 + Vitest 3 -> 4** (coupled, single atomic task)

Both together in one commit because they depend on each other. Vite 8 without Vitest 4 can break test runtime. Vitest 4 without Vite 8 misses optimizations.

**Risk:** moderate to high. Rolldown switch can surface plugin incompatibilities. vite-plugin-pwa and @vitejs/plugin-react must be checked.
**Effort:** 3-5h including fix round for plugin issues.
**Gate:** build, test, e2e-dev, e2e-production, size-limit.

Bundle delta can go positive (Rolldown generates smaller bundles) or negative (changed chunking heuristics). For ADR-0015's 350 KB budget probably unproblematic.

**3. Tailwind 3 -> 4** (separate task, largest scope)

Largest migration. Own work block. `npx @tailwindcss/upgrade` handles bulk, then manual review round through components. Check breaking changes on browser requirements vs Phylax target browsers.

**Risk:** high. Config paradigm shift and `@apply` edge cases are historical stumbling blocks.
**Effort:** 4-8h including UX test of all theme variants.
**Gate:** build, test, e2e-dev, e2e-production (visual regression if CSS drifts), size-limit.

### Alternative: all at once

Possible, not recommended. Three separate commits in one session likely produce 5-10h of work plus test failures. On problem diagnosis, unclear which upgrade caused the error. Atomic-per-upgrade keeps rollbacks clean.

---

## When to upgrade

**Not now during Tech Debt Sweep.** Three items still pending (TD-05 running, TD-06 pending), do not interrupt the sweep.

**After sweep completion:**

Three rational timing options:

- **Directly after TD-06**: codebase is clean, stable state. Major upgrades against clean baseline.
- **Before Phase 3/4 feature work**: upgrades are their own work, set up before new features get built on possibly outdated foundation.
- **Before Greek translation**: i18n work is more stable when foundation is current.

**Against immediate upgrade:**

- TS 6 is bridge to TS 7 (Q4 2026+). If TS 7 arrives soon, better direct jump to TS 7 (once stable).
- Vite 8 is 1 month old (March 2026). Ecosystem plugins may still have edge cases.
- Phylax is single-dev project. No pressure updates due to security issues on current versions.

**For immediate upgrade:**

- TS 6 is bridge release, deliberately low-friction.
- Vite 8 + Vitest 4 performance gain is real (Rolldown).
- Tailwind 4 build performance significantly better (3.5x-100x depending on scenario).
- If Phylax is planned long-lived, upgrade debt is easier paid down early than late.

---

## Decision open

This exploration does not answer the question, it just documents the state. Decision whether/when to upgrade stays with the user.

**Possible next steps:**

1. Wait until Tech Debt Sweep complete, then start upgrade sequence with TS 6
2. TS 6 immediately (low risk) while sweep runs in parallel
3. Ignore upgrades for now, prioritize Phase 3/4 feature work
4. Upgrade sequence as new phase entry in ROADMAP ("Phase 9: Dependency modernization")

Each path has legitimate reasons. No objectively-right call.

---

## Sources

Web-search based, npm registry as of April 2026:

- React 19.2.5: https://www.npmjs.com/package/react
- Vite 8.0.9: https://www.npmjs.com/package/vite
- Vitest 4.1.4: https://www.npmjs.com/package/vitest
- TypeScript 6.0.3: https://releasealert.dev/npmjs/_/typescript
- Tailwind 4.2.3: https://www.npmjs.com/package/tailwindcss

Release notes:

- Vite 8: https://vite.dev/releases
- TypeScript 6.0 Blog: https://devblogs.microsoft.com/typescript/
- Tailwind 4.0 Blog: https://tailwindcss.com/blog/tailwindcss-v4
- React 19.2 Blog: https://react.dev/blog/2025/10/01/react-19-2
