# Phase 1 Foundation Complete - State Report

**Audit date:** 2026-04-13

## 1. Executive summary

Phase 1 (Foundation) of Phylax is functionally complete. Tasks F-01 through F-16 are done. The remaining two tasks (F-17 GitHub Actions CI, F-18 README finalization) are infrastructure and documentation, not functionality.

The foundation delivers: a Vite-based PWA with master password onboarding, returning-user unlock with verification token, auto-lock after inactivity, an encrypted IndexedDB storage layer with a generic repository pattern, a responsive app shell with routing and protected routes, and five placeholder screens ready for Phase 2 features. The crypto layer (AES-256-GCM, PBKDF2 at 1.2M iterations, in-memory key store) is at 100% coverage. The overall project has 170 unit tests across 23 files and 18 E2E tests across 6 files, with 90.5% statement coverage project-wide.

Two deferred items carry into F-17: F-05b (per-module coverage thresholds for all modules) was partially activated (crypto 100%, db 95% are enforced; remaining modules deferred until they gain real code), and the offline production-mode E2E test from F-15 (Workbox precaching only works in production builds, deferred to a CI job that builds and tests against production).

## 2. Tasks completed

| Task  | Title                                | Commit                          | Status                     | Coverage                                                       |
| ----- | ------------------------------------ | ------------------------------- | -------------------------- | -------------------------------------------------------------- |
| F-01  | Vite + React + TypeScript + Tailwind | `0e9ad91`                       | Done                       | N/A (scaffolding)                                              |
| F-02  | Folder structure                     | `ccfa3cc`                       | Done                       | N/A (scaffolding)                                              |
| F-03  | ESLint import boundary rules         | `0143e18`                       | Done                       | N/A (config)                                                   |
| F-04  | Husky + lint-staged                  | `b0b9e6a`                       | Done                       | N/A (config)                                                   |
| F-05  | Vitest + fake-indexeddb              | `fc5093f`                       | Done                       | N/A (test infra)                                               |
| F-05b | Per-module coverage thresholds       | Partial in `6fa207c`, `2366067` | Partially done             | crypto 100%, db 95% enforced. Others deferred.                 |
| F-06  | Playwright smoke test                | `11a9c90`                       | Done                       | N/A (test infra)                                               |
| F-06b | Cross-browser E2E                    | Not started                     | Deferred to later          | N/A                                                            |
| F-07  | AES-256-GCM encrypt/decrypt          | `6fa207c`                       | Done                       | crypto: 100/100                                                |
| F-08  | PBKDF2 key derivation                | `7b7bf76`                       | Done                       | crypto: 100/100                                                |
| F-09  | Key store (lock/unlock)              | `0269311`                       | Done                       | crypto: 100/100                                                |
| F-10  | Dexie schema v1 (8 tables)           | `2366067`                       | Done                       | db: 100/100                                                    |
| F-11  | Encrypted repository base class      | `7468bbe`                       | Done                       | db/repositories: 100/100                                       |
| F-12  | Master password onboarding           | `66bbd17`                       | Done                       | onboarding: 97.5%                                              |
| F-13  | Unlock flow with verification        | `8d47836`                       | Done                       | unlock: 94.7%                                                  |
| F-14  | Auto-lock with configurable timeout  | `661fdb3`                       | Done                       | auto-lock: 100/100                                             |
| F-15  | PWA (manifest, SW, icons)            | `b6454ae`                       | Done, offline E2E deferred | pwa-update: 100/100                                            |
| F-16  | App shell + routing                  | `353c72c`                       | Done                       | app-shell: 100/100, router: ProtectedRoute 100%, returnTo 100% |
| F-17  | GitHub Actions CI                    | Not started                     | Next                       | N/A                                                            |
| F-18  | README finalization                  | Not started                     | After F-17                 | N/A                                                            |

## 3. Architectural state

### Crypto layer (`src/crypto/`)

Five modules, all at 100% coverage:

- **aesGcm.ts**: `encrypt(key, plaintext) -> Uint8Array`, `decrypt(key, payload) -> Uint8Array`. Wire format: [IV 12 bytes][ciphertext + auth tag]. Uses `globalThis.crypto.subtle`.
- **keyDerivation.ts**: `deriveKeyFromPassword(password, salt) -> CryptoKey`, `generateSalt() -> Uint8Array`. PBKDF2-SHA256, 1.2M iterations, 32-byte salt, 256-bit AES-GCM key. Salt length validated at runtime.
- **keyStore.ts**: `unlock`, `unlockWithKey`, `lock`, `getLockState`, `encryptWithStoredKey`, `decryptWithStoredKey`, `onLockStateChange`. Single module-level `CryptoKey | null`. Listener system with error isolation. Memory-wiping limitation documented.
- **generateId.ts**: `generateId() -> string`. Wraps `crypto.randomUUID()`. Lives in crypto/ to respect ESLint rule.
- **constants.ts**: IV_LENGTH (12), AUTH_TAG_LENGTH (16), ALGORITHM ('AES-GCM'), PBKDF2_ITERATIONS (1,200,000), PBKDF2_HASH ('SHA-256'), SALT_LENGTH (32), DERIVED_KEY_LENGTH (256).
- **test-setup.ts**: Polyfills `globalThis.crypto` from Node's `webcrypto` for vitest. Checks `crypto.subtle` specifically (jsdom sets crypto but not subtle).

Key invariants: `crypto.subtle` only in `src/crypto/`. Non-extractable keys. Fresh IV per encryption. Salt validated on derivation.

### Storage layer (`src/db/`)

- **schema.ts**: `PhylaxDb` extends Dexie. 8 tables: profiles, observations, lab_values, supplements, open_points, profile_versions, documents, meta. All non-meta tables carry `profileId`. Compound indexes on `[profileId+createdAt]` for chronological tables. No content field indexes (privacy: theme/status/timing inside encrypted blob).
- **types.ts**: `EncryptedRow` with id, profileId, createdAt (Unix ms), updatedAt (Unix ms), payload (ArrayBuffer). Per-table type aliases. `MetaRow` with plaintext salt and schemaVersion.
- **repositories/encryptedRepository.ts**: Generic `EncryptedRepository<T extends DomainEntity>`. Serialization: domain -> JSON -> UTF-8 -> AES-GCM -> payload. Auto-ID, auto-timestamps. Update throws on immutable fields (id, profileId, createdAt). JSON limitations documented (Date, undefined, binary).
- **meta.ts**: `writeMeta`, `readMeta`, `metaExists`. Singleton pattern with id='singleton'. `VERIFICATION_TOKEN = 'phylax-verification-v1'`.
- **settings.ts**: `MetaPayload` (verificationToken + AppSettings). `encodeMetaPayload`/`decodeMetaPayload` with backward compat for legacy bare-token format. Clamp on write, validate on read.
- **test-helpers.ts**: `resetDatabase()`, `setupCompletedOnboarding(password)`. Leaves keyStore locked.

### Feature layer (`src/features/`)

| Feature      | State       | Key files                                                   |
| ------------ | ----------- | ----------------------------------------------------------- |
| onboarding   | Complete    | OnboardingFlow.tsx, useOnboarding.ts, passwordValidation.ts |
| unlock       | Complete    | UnlockScreen.tsx, useUnlock.ts                              |
| auto-lock    | Complete    | useAutoLock.ts, config.ts                                   |
| pwa-update   | Complete    | UpdatePrompt.tsx                                            |
| app-shell    | Complete    | AppShell.tsx, Header.tsx, NavBar.tsx                        |
| profile      | Placeholder | ProfilePlaceholder.tsx                                      |
| observations | Placeholder | ObservationsPlaceholder.tsx                                 |
| lab-values   | Placeholder | LabValuesPlaceholder.tsx                                    |
| documents    | Placeholder | DocumentsPlaceholder.tsx                                    |
| settings     | Placeholder | SettingsPlaceholder.tsx                                     |
| not-found    | Complete    | NotFound.tsx                                                |

### App shell and routing (`src/router/`, `src/features/app-shell/`)

- BrowserRouter (react-router-dom v7)
- Routes: / (redirect to /profile), /onboarding (full screen), /unlock (full screen + returnTo), /profile, /observations, /lab-values, /documents, /settings (all inside AppShell), \* (NotFound)
- ProtectedRoute: checks metaExists + getLockState, subscribes to onLockStateChange, redirects with `replace` navigation
- returnTo safety: rejects absolute URLs and protocol-relative paths
- Header: lock button calls lock(), triggers ProtectedRoute redirect via listener
- NavBar: 5 items, responsive (bottom mobile, side desktop), NavLink active highlighting

### PWA infrastructure

- vite-plugin-pwa with autoUpdate strategy
- Workbox precaches all bundled assets (16 entries, 338KB)
- Manifest: standalone display, theme #1f2937, categories [productivity]
- Icons: SVG source (Phi glyph), PNG generated via @resvg/resvg-js script
- UpdatePrompt: toast banner with update/dismiss buttons
- robots.txt: Disallow: /

### Test infrastructure

- **Vitest**: 170 tests across 23 files. jsdom default, node override for crypto-only tests.
- **Playwright**: 18 E2E tests across 6 spec files. Chromium only. Dev mode webServer.
- **Coverage provider**: v8. Per-module thresholds: crypto 100%, db 95%. Project floor 85%.
- **Pre-commit hook**: lint-staged + vitest related (staged TS/TSX files) + tsc --noEmit
- **Test isolation patterns**:
  - `vi.resetModules()` + dynamic import for keyStore tests (module-level state)
  - `vi.useFakeTimers()` AFTER async setup (PBKDF2 needs real timers)
  - `resetDatabase()` for Dexie cleanup between tests
  - `setupCompletedOnboarding()` for tests that need auth state
  - `page.evaluate(() => indexedDB.deleteDatabase(...))` for Playwright DB cleanup
  - `MemoryRouter` wrapper for components using react-router hooks

## 4. Decisions recorded

| ADR      | Title                             | Summary                                                                                                                              |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| ADR-0001 | PBKDF2 iterations                 | 1.2M iterations for PBKDF2-SHA256. Doubles OWASP 2023 baseline. ~420ms on mid-range hardware. Locked once ciphertexts are persisted. |
| ADR-0002 | Crypto module extraction deferred | src/crypto/ stays inside the repo until a second project needs it. Standard npm package, not Vite plugin.                            |
| ADR-0003 | Meta payload includes settings    | Expanded from bare verification token to JSON object with verificationToken + settings. Backward compat for legacy format.           |

**Decisions that should potentially become ADRs:**

- **Encrypted blob per row** (decided in F-10 plan): single `payload: ArrayBuffer` per row instead of per-field encryption. Rationale: simpler, leaks only row count and size, acceptable for single-user personal profile. An attacker who reads IndexedDB sees only structural metadata (id, profileId, timestamps).
- **No content field indexes** (decided in F-10 plan): theme, status, timing inside encrypted blob. In-memory filtering after decryption. Rationale: indexing content fields leaks health metadata. Acceptable performance for the dataset size.
- **Timer strategy A for auto-lock** (decided in F-14): clearTimeout + setTimeout on each activity event. Strategy B (setInterval + countdown) deferred. Rationale: simpler, no countdown UI needed yet.

## 5. Test infrastructure status

**Unit tests:**

| File                                               | Test count |
| -------------------------------------------------- | ---------- |
| src/crypto/aesGcm.test.ts                          | 14         |
| src/crypto/keyDerivation.test.ts                   | 12         |
| src/crypto/keyStore.test.ts                        | 20         |
| src/db/schema.test.ts                              | 8          |
| src/db/meta.test.ts                                | 5          |
| src/db/settings.test.ts                            | 6          |
| src/db/test-helpers.test.ts                        | 3          |
| src/db/fake-indexeddb.test.ts                      | 1          |
| src/db/repositories/encryptedRepository.test.ts    | 14         |
| src/features/onboarding/passwordValidation.test.ts | 14         |
| src/features/onboarding/useOnboarding.test.ts      | 10         |
| src/features/onboarding/OnboardingFlow.test.tsx    | 6          |
| src/features/unlock/useUnlock.test.ts              | 8          |
| src/features/unlock/UnlockScreen.test.tsx          | 5          |
| src/features/auto-lock/useAutoLock.test.ts         | 12         |
| src/features/pwa-update/UpdatePrompt.test.tsx      | 4          |
| src/features/app-shell/AppShell.test.tsx           | 2          |
| src/features/app-shell/Header.test.tsx             | 3          |
| src/features/app-shell/NavBar.test.tsx             | 3          |
| src/router/ProtectedRoute.test.tsx                 | 4          |
| src/router/returnTo.test.ts                        | 6          |
| src/lib/eslint-restrictions.test.ts                | 8          |
| src/lib/sample.test.ts                             | 2          |
| **Total**                                          | **170**    |

**E2E tests:**

| File                         | Test count |
| ---------------------------- | ---------- |
| tests/e2e/smoke.spec.ts      | 1          |
| tests/e2e/onboarding.spec.ts | 4          |
| tests/e2e/unlock.spec.ts     | 4          |
| tests/e2e/auto-lock.spec.ts  | 1          |
| tests/e2e/pwa.spec.ts        | 3          |
| tests/e2e/navigation.spec.ts | 5          |
| **Total**                    | **18**     |

**Known test gaps:**

- Offline production-mode E2E test (Workbox precaching, deferred to F-17 CI job)
- No test for the `routes.tsx` file (0% coverage, routes are verified indirectly via E2E)
- Placeholder components have 0% coverage (trivial render-only, not worth testing individually)
- The `src/domain/` folder contains only empty scaffold `index.ts` files, no domain logic yet
- No test for the meta write failure -> keyStore rollback path in useOnboarding (the error branch)

## 6. Dependency state

**Production (4 packages):**

| Package          | Version | In locked list? |
| ---------------- | ------- | --------------- |
| react            | 18.3.1  | Yes (core)      |
| react-dom        | 18.3.1  | Yes (core)      |
| react-router-dom | 7.14.0  | Yes (core)      |
| dexie            | 4.4.2   | Yes (core)      |

Missing from installed but in locked core list: `jspdf` (Phase 5), `i18next` (Phase 7), `react-i18next` (Phase 7), `tailwindcss` (installed as dev dep, used at build time).

**Dev (31 packages):** All match the locked list. Additional dev packages not in the original locked list but approved during development:

- `@resvg/resvg-js` (icon generation script, approved in F-15)
- `vite-plugin-pwa` (was in locked list)
- `autoprefixer`, `postcss`, `prettier-plugin-tailwindcss` (Tailwind toolchain, implicit)
- `@types/react`, `@types/react-dom` (TypeScript types, implicit)

No unauthorized dependencies detected.

## 7. Open technical debt

1. **Icons are functional but crude**: SVG source has a serif Phi glyph on dark gray. PNGs are generated but the design is placeholder-quality. Needs professional icon design before v1.0.

2. **No production-mode E2E tests**: Workbox offline caching, service worker update flow, and PWA install are only verifiable in production builds. F-17 should add a CI job that builds and tests against the production output.

3. **generateId lives in src/crypto/ as ESLint workaround**: `crypto.randomUUID()` uses the restricted crypto global. The function is conceptually a utility, not crypto. The ESLint rule stays clean but the file placement is slightly misleading.

4. **routes.tsx at 0% coverage**: The route tree definition is not unit-tested. It is covered indirectly by E2E tests. A dedicated integration test of the route tree could catch configuration errors faster.

5. **Verification token format is versioned (v1) but no migration path exists**: If v2 is ever needed, code to handle v1 -> v2 migration must be written. Currently only backward compat for legacy bare-token format.

6. **Bundle size exceeds original 250KB gzipped budget**: At 100KB gzipped JS after adding react-router-dom. The budget was set before the routing library was added. Needs re-evaluation in P-08 (performance audit).

7. **src/domain/ contains only empty scaffolds**: The domain layer has no real code yet. `domain/entries/` still exists from pre-realignment scaffolding (should be `domain/profile/` and `domain/observations/`). Cleanup when Phase 2 begins.

8. **Meta write failure rollback path not tested**: useOnboarding has a try/catch that locks keyStore if the Dexie transaction fails. This error branch is not tested. Adding a test requires mocking Dexie's transaction, which is complex but worthwhile.

9. **Multiple Phylax tabs not coordinated**: Auto-lock in one tab does not affect another. Each tab has its own in-memory keyStore. Documented as a limitation.

10. **Settings UI missing**: Auto-lock timeout is configurable in the data model but there is no UI to change it. Defaults to 5 minutes. Settings screen is P-05.

## 8. What Phase 2 inherits

Phase 2 (Profile) builds on:

- **EncryptedRepository<T>** is ready to be extended for ObservationRepository, LabValueRepository, SupplementRepository, OpenPointRepository, ProfileVersionRepository. Each concrete repository only needs a constructor pointing to the correct Dexie table.
- **Dexie schema** has all 8 tables declared with correct indexes. Phase 2 writes to profiles, observations, lab_values, supplements, open_points, profile_versions.
- **Routing structure** has placeholder screens at /profile, /observations, /lab-values, /documents, /settings that will be replaced with real components.
- **Lock state** is plumbed through ProtectedRoute, onLockStateChange listeners, and auto-lock. Any new feature screen inside the app shell automatically inherits auth protection.
- **Settings infrastructure** in MetaPayload is additive: new settings fields can be added to AppSettings without migration.
- **Password validation** and **strength estimation** are reusable if Phase 2 adds password-related features.
- **Test helpers** (resetDatabase, setupCompletedOnboarding) provide a clean starting state for any test that needs an authenticated Phylax instance.

## 9. Coverage summary table

| Module                         | Lines     | Branches  | Functions | Statements |
| ------------------------------ | --------- | --------- | --------- | ---------- |
| src/crypto/                    | 100%      | 100%      | 100%      | 100%       |
| src/db/ (excl. repositories)   | 97.9%     | 92.9%     | 100%      | 97.9%      |
| src/db/repositories/           | 100%      | 100%      | 100%      | 100%       |
| src/features/app-shell/        | 100%      | 100%      | 100%      | 100%       |
| src/features/auto-lock/        | 100%      | 100%      | 100%      | 100%       |
| src/features/onboarding/       | 97.5%     | 92.9%     | 100%      | 97.5%      |
| src/features/pwa-update/       | 100%      | 100%      | 100%      | 100%       |
| src/features/unlock/           | 94.7%     | 89.3%     | 100%      | 94.7%      |
| src/router/ (excl. routes.tsx) | 100%      | 100%      | 100%      | 100%       |
| src/router/routes.tsx          | 0%        | 0%        | 0%        | 0%         |
| Placeholder screens (5 files)  | 0%        | 0%        | 0%        | 0%         |
| **Project total**              | **90.5%** | **93.2%** | **91.9%** | **90.5%**  |

## 10. Recommendations for F-17 and F-18

### F-17 (GitHub Actions CI)

**Jobs to include:**

1. **Lint + Typecheck + Unit Tests + Build** (the `make check` equivalent)
2. **E2E Tests** against dev server (current Playwright setup)
3. **Production E2E Tests** (new): `make build` then run Playwright against `make preview`. Include the offline test deferred from F-15.
4. **Coverage enforcement**: run `make test-coverage` and fail if thresholds drop. Consider uploading the lcov report as a build artifact.
5. **Bundle size check**: `du -sh dist/assets/*.js` and fail if gzipped JS exceeds a budget (suggest 150KB gzipped, revisiting the original 250KB raw target).

**Matrix:**

- Node 18 (current) and Node 20 (Dexie 4 prefers Node 20, we should test both)
- Chromium only for E2E (Firefox and WebKit in F-06b)

**Caching:** `node_modules` via `actions/cache` keyed on `package-lock.json` hash. Playwright browser cache.

### F-18 (README finalization)

The README already exists and was updated in R-03. F-18 should:

1. Add screenshots (once there is a real UI beyond placeholders, so this may need to wait for early Phase 2)
2. Review and update the "Getting started" section for accuracy
3. Add a "Development" section with notes on:
   - PWA dev mode caveats (stale SW cache, clear via chrome://serviceworker-internals)
   - Fake timers + PBKDF2 test pattern
   - `make icons` for icon regeneration
4. Finalize the threat model summary for non-technical readers
5. License is already MIT, confirmed in LICENSE file
6. Contribution: already states "solo project, contributions not accepted yet"

F-18 may be a smaller task than originally scoped since the README was substantially built in earlier commits.
