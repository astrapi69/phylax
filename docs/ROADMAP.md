# Phylax Roadmap

> **v1.0.0 shipped on 2026-04-18** ([release](https://github.com/astrapi69/phylax/releases/tag/v1.0.0)).
> Tag points at commit `b0b91e6`. Future changes land in `[Unreleased]` in CHANGELOG.md.

This document is the source of truth for what to build next. Tasks are grouped by phase. Each task has an ID. When a task is finished, check its box and update the commit reference.

Task ID prefixes:

- **F** Foundation
- **O** Observations / Profile (core profile structure and CRUD)
- **AI** AI-guided input (prompt contract, guided session, paste-in)
- **D** Documents (file upload and storage)
- **X** eXport (PDF, Markdown, CSV)
- **B** Backup and restore
- **P** Polish (UI, i18n, accessibility)
- **M** Multi-profile (future, proxy profile support)
- **DP** Derived plans (diet, training, supplement, medication plans)
- **IM** Import (parse external Markdown profiles into the local database)
- **V** Views (read-only screens that render imported profile data)
- **T** Theming (dark mode and other appearance concerns)

---

## Phase 1: Foundation

Goal: a working PWA shell with master password, encryption layer, and an empty but functional database.

- [x] **F-01** Vite project setup with React 18, TypeScript strict, Tailwind, ESLint, Prettier
- [x] **F-02** Folder structure per `architecture.md` (`crypto/`, `db/`, `domain/`, `features/`, `ui/`, `i18n/`, `lib/`)
- [x] **F-03** ESLint rules: restrict `crypto.subtle` to `src/crypto/`, restrict `dexie` to `src/db/`
- [x] **F-04** Husky + lint-staged pre-commit hook
- [x] **F-05** Vitest setup with `fake-indexeddb`, sample test green
- [x] **F-05b** Enable per-module coverage thresholds in vitest config (activate after F-11)
- [x] **F-06** Playwright setup with one smoke test
- [ ] **F-06b** Cross-browser E2E: add Firefox and WebKit projects to Playwright config
- [x] **F-07** Crypto module: AES-256-GCM encrypt/decrypt with round-trip and negative tests
- [x] **F-08** Crypto module: PBKDF2 key derivation with salt, 600k iterations, constants in `crypto/constants.ts`
- [x] **F-09** Key store module: in-memory key holder, lock/unlock API, no persistence
- [x] **F-10** Dexie schema v1: `profiles`, `observations`, `lab_values`, `supplements`, `open_points`, `profile_versions`, `documents`, `meta` tables. All entities carry `profileId`.
- [x] **F-11** Generic encrypted repository base class (encrypt before put, decrypt after get)
- [x] **F-12** Master password onboarding flow: set, confirm, derive key, store salt
- [x] **F-13** Unlock flow: enter password, derive key, verify against test ciphertext
- [x] **F-14** Auto-lock: configurable inactivity timeout, default 5 minutes, clears in-memory key
- [x] **F-15** PWA config via `vite-plugin-pwa`: manifest, icons, service worker with autoUpdate
- [x] **F-16** App shell: router, locked/unlocked state, basic layout
- [x] **F-17** GitHub Actions CI: typecheck, lint, test, build on every PR
- [x] **F-18** README with install instructions, threat model summary, screenshots

---

## Phase 2: Profile

Goal: the living medical profile as core artifact. Observation CRUD grouped by theme, profile versioning, markdown rendering.

- [x] **O-01** Domain types for profile, observation (fact/pattern/self-regulation/status), lab value, supplement, open point, profile version in `domain/`
- [x] **O-02** Validation rules for observations (required fields, theme non-empty, status enum)
- [x] **O-03** Profile repository: create default profile on first unlock, read, update base data
- [x] **O-04** Observation repository: create, read, update, delete, list by theme, all encrypted
- [x] **O-05** Lab value repository: create, read, update, delete, list by date, all encrypted
- [x] **O-06** Supplement repository: create, read, update, delete, list, all encrypted
- [x] **O-07** Open point repository: create, read, update (toggle), delete, list, all encrypted
- [x] **O-08** Profile version repository: create version entry on every profile change, list history
- [x] **O-09** Profile view: render the full profile as structured markdown
- [ ] **O-10** Observation form: theme selector (free text or existing), fact/pattern/self-regulation/status fields
- [ ] **O-11** Observation list grouped by theme, expandable detail
- [ ] **O-12** Lab value form: date, parameter, result, reference range, assessment
- [ ] **O-13** Lab value table view with status indicators
- [ ] **O-14** Supplement plan form: time of day, supplement, purpose
- [ ] **O-15** Open points checklist with add/toggle/delete
- [ ] **O-16** Profile base data editor: name, age, diagnoses, medications, limitations
- [ ] **O-17** In-memory search across decrypted observations (theme, fact, pattern)
- [ ] **O-18** Date range filter for observations and lab values
- [ ] **O-19** Empty states and loading skeletons
- [ ] **O-20** Edit and delete confirmations via modal, no `confirm()`

---

## Phase 2b: Profile Import

Goal: users with an existing Markdown profile in the "Lebende Gesundheit" (Living Health) format can bring it into Phylax in one step, instead of re-entering every observation, lab value, and supplement by hand. Pure client-side parsing, no upload.

Note on IDs: the parser was originally committed under the `[O-07]` tag before this section existed. The ROADMAP's `O-07` refers to the Open Point Repository; the commits are preserved as-is (git history is immutable) and the task lives here instead.

- [x] **IM-01** Markdown profile parser for Living Health format: pure function, no DB/crypto coupling, ParseResult + ParseReport with warnings and unrecognized blocks (commits `eac9eae`, `4ffab8e`)
- [x] **IM-02** Anonymized example fixture and integration test against the real profile shape (commit `4ffab8e`)
- [x] **IM-03a** Headless import: `importProfile` with pre-encrypt + Dexie bulk-put transaction, `useImport` state machine, `BaseData.name` field with display-name helper (commit pending)
- [x] **IM-03b** Import UI: file picker or paste-in, structured preview with counts/warnings/unrecognized, profile selection, confirm-replace dialog (commit pending)
- [ ] **IM-04** Post-import navigation: land on the imported profile, create profile version entry automatically
- [ ] **IM-05** Import conflict handling beyond replace-all: detect existing data, offer replace vs. selective merge vs. cancel
- [x] **IM-06** Distinguish empty placeholder sections from malformed observation entries: parser emits info-severity notice for blank H3 under Relevante Vorgeschichte, warning-severity for content-but-no-recognized-fields, skips ghost entity creation in both cases. Preview UI splits into separate warnings / skipped-sections disclosures (commit pending)

---

## Phase 2c: Profile Views

Goal: render imported profile data as readable screens. All read-only in this phase; editing is deferred to a later phase that has its own form patterns. First view task replaces the `/profile` placeholder with actual BaseData; subsequent tasks cover the other entity types one at a time.

- [x] **V-01** Profile overview view at `/profile`: BaseData, doctor, diagnoses, medications, limitations, warning signs, external references, context notes (commit pending)
- [x] **V-02** Observations view: list grouped by theme, expandable detail per observation (commit pending)
- [x] **V-03** Lab values view: reports with values table, per-category assessments, reference ranges (commit pending)
- [x] **V-04** Supplements view: list grouped by category (daily / regular / paused / on-demand) with rationale (commit pending)
- [x] **V-05** Open points checklist view: grouped by context, priority and time-horizon badges (commit pending)
- [x] **V-06** Timeline / Verlaufsnotizen view: chronological list of entries with Markdown bodies (commit pending)
- [x] **V-02b** Observations sort enhancement: recent-first default with alphabetical toggle, post-commit highlight so AI updates surface immediately

---

## Phase 2d: Theming

Goal: comfortable cross-environment appearance. Starts with dark mode; future tasks may add high-contrast or reduced-motion variants if a need emerges.

- [x] **T-01a** Theme state infrastructure: ThemeProvider + useTheme + ThemeToggle + SettingsScreen with ThemeSection, flash-prevention inline script, matchMedia test shim (commit pending)
- [x] **T-01b** Dark mode variants applied across every existing screen and component (commit pending)
- [x] **T-02a** Theme and a11y smoke infrastructure: helpers, axe integration, onboarding smoke test as first screen (commit pending)
- [x] **T-02b** Smoke tests extended to the remaining screens plus any a11y fixes surfaced by the matrix (commit pending)
- [x] **T-03** Bundle size budgets via size-limit (per-asset gzipped budgets enforced in CI, ADR-0010) (commit pending)
- [x] **T-04a** Stryker installation and minimal config (crypto scope, dry-run validated) (commit pending)
- [x] **T-04c** Crypto mutation baseline: 100% killed, threshold 95, 1 Category A fix, 2 Category B exclusions (commit pending)
- [x] **T-04e** Repositories mutation baseline: 100% killed, threshold 95, 3 Category A fixes (commit pending)
- [x] **T-04f** Parser mutation baseline: 57.81%, threshold 55, per-module config strategy, 1 Category A fix (commit pending)
- [x] **T-04g** Import mutation baseline: 81.16%, threshold 75, 9 Category A fixes, 8 Category B exclusions (commit pending)
- [x] **T-04h** Nightly CI workflow, ADR-0011 (mutation testing strategy with baselines and survivor-handling policy) (commit pending)

> Parser test hardening deferred: 271 survivors in T-04f, sample triage showed ~25% Category A,
> ~45% Category B, ~30% Category C. Dedicated edge-case fixtures needed per section parser.

---

## Infrastructure (I-series)

Cross-cutting infrastructure maintenance that is not tied to a product phase.

- [x] **I-01** Node 20 LTS requirement (drop Node 18, add `.nvmrc`, `engines` field, update CI matrix to 20 + 22) (commit pending)
- [x] **I-02** Rules update: test strategy, task series conventions, mutation thresholds in quality-checks (commit pending)
- [x] **I-03** Move coverage checks to CI-only (drop `test-coverage` from `ci-local-full`; CI runs it, local devs skip the instrumentation overhead)
- [x] **I-04** Privacy disclosure precision: AI-02 disclaimer names 30-day Anthropic retention, BYOK ownership, no-training guarantee; PrivacyInfoPopover in chat header + settings (commit `e067bae`)

---

## Phase ONB: Onboarding UX restructure

Goal: replace the single-screen context-less password prompt with a guided three-screen first-run flow, a slim unlock for returning users, and a parallel import-from-backup path. Introduces `/welcome`, `/privacy`, `/setup`, `/backup/import/select`, `/backup/import/unlock` routes plus an entry router at `/` that picks the correct starting point based on vault state.

- [x] **ONB-01a** Entry router + 5 stub views (WelcomeView, PrivacyView, SetupView, BackupImportSelectView, BackupImportUnlockView). `/` mounts EntryRouter which decides /welcome (no vault), /unlock (locked), or /profile (unlocked). Old `/onboarding` retained as fallback until ONB-01c. New `src/features/backup-import/` folder. 9 new unit tests (4 EntryRouter + 5 stub). Existing Playwright e2e suite updated to navigate via `/onboarding` directly (smoke test + helpers + onboarding/profile-create specs). Future cleanup: extract shared auth-destination resolver between EntryRouter and ProtectedRoute
- [x] **ONB-01b** Real WelcomeView + PrivacyView implementations + DE/EN i18n copy (logo, tagline, three trust signals, three privacy paragraphs, CTAs)
- [x] **ONB-01c** SetupView + useSetupVault hook + zxcvbn-ts lazy-load + ADR-0014 (Option C: core + language-common only, ~241 KB gzipped lazy chunk). Replaces old OnboardingFlow + useOnboarding + stubViews.test. `<WarningCallout>` in `src/ui/`. `/onboarding` route removed; catch-all NotFound covers the URL. Size-limit entry added for the setup lazy chunks. Main bundle 206.21 KB gzipped (under 250 KB).
- [x] **ONB-01d** UnlockView refactor + rate-limiter (exponential backoff from 2s, cap 60s, sessionStorage). `UnlockScreen` renamed to `UnlockView`. Added `rateLimit.ts` (per-tab sessionStorage, `phylax-unlock-rate-limit`), countdown with 250ms ticker + `aria-live="polite"`, backup-import link, DE/EN `rate-limit.*` + `backup-link.*` + `error.no-meta` keys with `_one/_other` plurals. `useUnlock` tightened: `no-meta` surfaces as typed error instead of throwing. `useSetupVault` calls `recordSuccessfulAttempt()` defensively.
- [x] **ONB-01e** BackupImportSelectView + BackupImportUnlockView + `backup-import` i18n namespace (DE + EN) + `.phylax` backup format spec in `docs/backup-format.md`. New modules: `parseBackupFile`, `decryptBackup`, `populateVault`. `rateLimit.ts` refactored into `createRateLimiter(storageKey)` factory; backup-import uses its own counter keyed at `phylax-backup-import-rate-limit`. `deriveKeyFromPassword` extended with optional `iterations` parameter so backups with different iteration counts decrypt correctly. Overwrite warning via `WarningCallout` when `metaExists()`. Post-import navigation routes to `/profile` or `/profile/create` based on dump contents. Security-sensitive format is spec'd with iteration floor/ceiling (100k-10M), salt length enforcement, and explicit "does not prevent downgrade attack" documentation.
- [x] **ONB-01f** Playwright e2e suite covering all onboarding paths (first-run 3-screen flow, setup validation, returning-user unlock, rate-limit lockout, backup-import from welcome, `/onboarding`-returns-404 defensive). In-browser `.phylax` fixture generation via `page.evaluate` + Web Crypto. Fixed latent `ProtectedRoute` bug: redirect target changed from removed `/onboarding` to `/welcome` so fresh installs that reach a protected route via direct-link route to the welcome flow instead of the 404 catch-all. Migrated `tests/e2e/helpers.ts` + `profile-create.spec.ts` off the removed `/onboarding` route to `/setup`. PBKDF2 iteration-count references updated from stale `600k` to `1.2M` across 6 docs (`CLAUDE.md`, `.claude/rules/architecture.md`, `.claude/rules/lessons-learned.md`, `src/crypto/README.md`, `src/crypto/constants.ts` JSDoc, `docs/CONCEPT.md` two mentions).

---

## Tech Debt

Tracked items from completed work. Prioritize independent of current phase.

- [x] **EntryRouter + ProtectedRoute + SetupFlowGuard auth-decision duplication** - shared `resolveAuthState()` helper at `src/router/resolveAuthState.ts` returns `'no-vault' | 'locked' | 'unlocked'`. All three guards call it and map the state to their own policy (Navigate target, render children, returnTo encoding). No behavior change; existing consumer tests act as regression harness. Shipped in TD-06.
- [x] **SetupFlowGuard unlocked-redirect to /profile** - authenticated users direct-linking to `/welcome`, `/privacy`, or `/setup` now land on `/profile` instead of `/unlock`; locked users still go to `/unlock`; no-vault users still render the setup flow. Shipped in TD-07.
- [x] **German transliteration in non-locale source code (TD-09)** - (a) parser input keys gained backward-compatible dual lookup (Unicode `märz`/`Ä`/`ä`/`ernährung` alongside the original ASCII transliterations); fixture integration test still passes. (b) AI prompt fragments rewritten to Unicode. (c) Export labels emit Unicode (`Änderungsgrund`, `Einschränkungen`, `Größe`, `Präparat`, `regelmäßig`, `täglich`, `Verträglichkeiten`); round-trip via (a)'s dual lookup stays clean. Shipped across three commits.
- [x] **CI hardening for Playwright system-deps install (TD-10)** - all four sub-items shipped. (a) apt-conf retries/timeouts in `f2c61f3`. (a2) `timeout 240s` wrapper in `3cd1146` (without which the bash retry loop could not iterate on hangs, only on exits). (b) + (c) resolved by construction in the `fix/td-10-ci-hardening` branch: E2E jobs now run inside `mcr.microsoft.com/playwright:v<version>-noble` container with browsers and system deps pre-baked, eliminating apt from the CI critical path entirely. (d) all Node-runtime actions bumped to their latest majors (checkout v6, setup-node v6, cache v5, upload-artifact v7, download-artifact v8) in the same branch, clearing the 2026-09-16 Node 20 removal cliff. Makefile-wrapper rule in `.claude/rules/ai-workflow.md` got a CI-in-container exception so the container jobs can call `npm`/`npx` directly without reintroducing apt to install `make`.
- [ ] **Setup chunk headroom 9 KB** - `.size-limit.json` "Setup lazy chunks" entry sits at 240.96 / 250 KB. Any `@zxcvbn-ts/core` or `@zxcvbn-ts/language-common` minor bump that adds >9 KB breaks CI. Pinning is in place (ADR-0014); monitor for version updates and re-measure on each bump.
- [ ] **zxcvbn-ts language packs not shipped** - ADR-0014 Option C omits `language-en` and `language-de` (would have added ~931 KB gzipped). Random dictionary words, compound words, and names-as-passwords pass as "strong". Revisit if usability study, community feedback, or security review surfaces a concrete need.
- [x] **CI E2E gate** - `e2e-dev` and `e2e-production` jobs run on `push:[main]` and `pull_request:[main]`, caught the IM-06 regression that would previously have shipped silent. TD-04 hardened both jobs with `timeout-minutes: 15` and `playwright-report/` failure-artifact upload (14-day retention); branch-protection required-checks list documented in `docs/ci-gates.md`.
- [x] **`/welcome` with existing vault has no redirect guard** - new `SetupFlowGuard` nested layout route wraps `/welcome`, `/privacy`, and `/setup`; redirects to `/unlock` when `metaExists()` is true, fails open on IndexedDB errors so users are not stuck. Defensive belt-and-suspenders check inside `useSetupVault.runSetup()` refuses to overwrite existing meta (new `SetupError.kind` `'vault-already-exists'`). Shipped in TD-05.
- [ ] **Lazy-load non-primary locales** - currently all locale JSONs are statically imported into the main bundle per Vite's default chunking (see I18N-02-e). ADR-0015 accepts this eager strategy and raises the budget to absorb multilingual growth. Optimization path when bundle pressure genuinely binds: restructure `src/i18n/config.ts` to async-import locale bundles on demand, reducing main JS by ~30-50 KB at the cost of a brief loading state for non-DE users and async paths in the detector. Deferred.
- [x] **Playwright config drift prevention** - shared `playwright.config.base.ts` exports `baseConfig` / `baseUse` / `baseProjects`; dev and production configs spread them and declare only env-specific fields (testDir, baseURL, webServer command/port). Prevents drift by construction rather than detection. Shipped in TD-03 (commit `73e911a`).

---

## Phase 3: AI-Guided Input

Goal: AI as primary input method for profile creation and updates. User provides fragments, AI structures them into the profile format.

- [x] **AI-01** Settings: API key input (Anthropic), encrypted in storage, provider selection (OpenAI follow-up)
- [x] **AI-02** Disclaimer on first activation: not medical advice, data leaves device to AI provider, user controls key
- [x] **AI-03** System prompt implementing the prompt contract: structure only, no diagnosis, mark uncertainties, use observation model (fact/pattern/self-regulation)
- [x] **AI-04** Extended system prompt for proxy profiles: mark caregiver-perspective, distinguish observed vs. reported
- [x] **AI-05** Chat UI: ephemeral messages (not persisted), clear "AI assistant" labeling
- [x] **AI-06** Guided profile session flow: AI walks user through profile sections (observations, supplements, open points; base data + lab values + Verlaufsnotizen explicitly out of scope) (commit `a825416`)
- [x] **AI-07** Structured output: AI produces markdown profile fragment at end of session (detection + preview modal; commit lands in AI-08)
- [x] **AI-08** Review and commit flow: user reviews AI output, edits if needed, commits to profile with version entry
- [x] **AI-09** Parser fallback via AI: on parse failure (empty or low+warnings), offer "KI-Hilfe anfordern" that reformats user paste into Phylax markdown, re-parses, and routes back through the import flow (commit `3fa3e26`)
- [x] **AI-10** Network call only when chat is actively used, no background calls
- [x] **AI-11** One-click disable: removes API key, disables AI features, manual mode only

---

## Phase 4: Documents

Goal: upload PDFs and images, store them encrypted, view them, link them to profile sections.

- [ ] **D-01** Document repository: store encrypted blobs with metadata, linked to profileId
- [ ] **D-02** File upload component with size limit (10MB per file) and type validation
- [ ] **D-03** Encrypted blob storage: chunk large files if needed
- [ ] **D-04** Document list view with thumbnails for images
- [ ] **D-05** PDF viewer (native browser PDF or `pdf.js` if bundling is acceptable)
- [ ] **D-06** Image viewer with zoom
- [ ] **D-07** Link documents to observations or lab values
- [ ] **D-08** Delete document with cascade check (warn if linked)
- [ ] **D-09** Storage quota indicator (used vs available)
- [ ] **D-10** Request persistent storage via `navigator.storage.persist()` on first upload

---

## Phase 5: Export

Goal: export the profile as PDF for doctor visits, as markdown for archiving, as CSV for lab values.

- [x] **X-01** Markdown export: pure export function round-trip compatible with IM-01 parser, download trigger, filename convention, ExportOptions contract (dateRange + themes) for future filter UIs, useExportData hook, ExportDialog + ExportButton wired into ProfileView header and Settings (commits `4d2bdc4` budget bump ADR-0012, `a7b5e21` feature)
- [ ] **X-02** PDF export with `jsPDF`: header, base data, observations by theme, lab values, supplements, open points
- [ ] **X-03** Date range selector for export
- [ ] **X-04** Theme filter for export (include only selected observation themes)
- [ ] **X-05** Include linked documents as appendix (or list them by name)
- [ ] **X-06** CSV export for lab values (date, parameter, result, reference, assessment)
- [ ] **X-07** Export preview before download
- [ ] **X-08** Filename convention: `phylax-profil-YYYY-MM-DD.pdf` / `.md` / `.csv`

---

## Phase 6: Backup and Restore

Goal: user can export an encrypted backup file and restore it on the same or another device.

- [x] **B-01** Backup file format spec: `.phylax` envelope (version, salt, KDF params) with AES-256-GCM encrypted inner payload. Spec'd in `docs/backup-format.md`. Delivered in ONB-01e alongside the import path.
- [x] **B-02** Backup export: `src/features/backup-export/` with `buildVaultDump` (per-repository `listAll()` reads), `createBackup` (fresh salt + PBKDF2-derived key + AES-GCM encrypt), `downloadBackup`, and a settings-panel section under "Datenverwaltung". Password prompt is explicit (no silent reuse of the in-memory master key; zero-knowledge model preserved).
- [x] **B-03** Backup import: file picker, envelope parsing, password-driven decryption. Delivered in ONB-01e (`parseBackupFile`, `decryptBackup`).
- [x] **B-04** Restore flow: overwrite warning via `WarningCallout`, single Dexie transaction replaces all tables. Delivered in ONB-01e (`populateVault`).
- [ ] **B-05** Merge-mode backup import — **deferred.** Requires clearer use case than current single-device MVP provides. Re-evaluate at Phase 8 (multi-profile M-series) planning or if multi-device sync is considered. Merge semantics depend on the scope that eventually drives the need (multi-device sync -> automatic conflict resolution, multi-profile -> curated per-row decisions, profile sharing -> scoped subset), so picking a semantics now risks being wrong for whichever follow-up phase actually ships it. See B-05 scope analysis in the 2026-04-21 B-02 follow-up (Q1-Q6: newer-updatedAt-wins, map-to-local profileId, keep-local meta, radio-in-unlock, re-encrypt under stored key, unlocked precondition).
- [x] **B-06** Backup encryption uses its own salt, independent from the live key. Enforced by the format spec and verified per-export in `createBackup`.
- [x] **B-07** End-to-end test: create profile with observations, export, wipe, import, verify identical state. Programmatic round-trip in `src/features/backup-export/roundTrip.test.ts` (Vitest integration) plus a Playwright spec `tests/e2e/backup-export.spec.ts` that verifies the download gesture produces a spec-compliant envelope.

---

## Phase 7: Polish

Goal: production-quality UX, mobile-ready, accessible, internationalized.

- [ ] **P-01** Mobile-first responsive review of every screen at 360px, 768px, 1024px
- [ ] **P-02** Dark mode via Tailwind `dark:`, system preference detection, manual override
- [ ] **P-03** i18next setup with DE and EN translations
- [ ] **P-04** Onboarding tour: explain living health concept, local-first, encryption, no cloud, AI role, threat model in plain language
- [ ] **P-05** Settings screen: auto-lock timeout, language, theme, change master password, API key management
- [ ] **P-06** Change master password flow: re-encrypt all records with new key
- [ ] **P-07** Accessibility audit: keyboard navigation, screen reader labels, focus management
- [ ] **P-08** Performance audit: bundle under 350 KB gzipped (per ADR-0015), TTI under 3s on mid-range phone
- [ ] **P-09** Error boundary with friendly message and recovery option
- [ ] **P-10** Toast system for user feedback (success, warning, error)
- [ ] **P-11** Add ES, FR, EL translations (matching the developer's language background)
- [ ] **P-12** Privacy policy and license page in-app

---

## Phase 8: Multi-Profile (future)

Goal: support multiple profiles per installation. Own profile plus proxy profiles for family members.

This phase is NOT part of the MVP. The data model supports it from day one via `profileId`, but the UI and logic are deferred.

- [ ] **M-01** Profile list view: show all profiles, switch between them
- [ ] **M-02** Create new profile: own or proxy (Stellvertreterprofil)
- [ ] **M-03** Proxy profile metadata: managed-by field, relationship
- [ ] **M-04** Profile-scoped views: all screens filter by active profileId
- [ ] **M-05** Backup/restore per profile or all profiles

---

## Phase 9: Derived Plans (future)

Goal: generate structured plans from the medical profile. Every derived plan carries a mandatory "consult your doctor" disclaimer. Phylax structures information; it does not prescribe or diagnose.

This phase depends on Phase 2 (profile data must exist before plans can be derived).

- [ ] **DP-01** Diet plan template (based on target weight, caloric deficit, profile constraints)
- [ ] **DP-02** Training plan template (respects joint issues, pulse zones, known limitations)
- [ ] **DP-03** Supplement plan template (keep / pause / on-demand categories, as reflected in the existing profile)
- [ ] **DP-04** Medication plan template
- [ ] **DP-05** Doctor-focused export format (condensed profile for clinical visits, separate from full export)
- [ ] **DP-06** AI-assisted plan derivation (with enforced disclaimer presence and audit trail of AI suggestions)

---

## Release (R-series)

Repository-level release preparation. No deployment.

- [x] **R-01** Finalize PWA icons (72 through 512, plus maskable-192) and manifest (lang/dir/categories, full icon set) (commit `f0bc6a8`)
- [x] **R-02** README rewrite for external readers: features, screenshots placeholders, privacy summary, AI opt-in, donation link, acknowledgments (commit `40d7b1c`; screenshots tracked in issues #6-#9)
- [x] **R-03** CHANGELOG.md with Keep-a-Changelog format, grouped by user-facing category with task-ID traceability (commit `1a576cd`)
- [x] **R-04** GitHub repo metadata: 20 topics (added `privacy-first` + `claude-api`), private vulnerability reporting enabled, SECURITY.md, .github/FUNDING.yml with 5 channels; existing description preserved (commit `8399749`)
- [x] **R-05** v1.0.0 git tag and GitHub Release (tag at `b0b91e6`, [release page](https://github.com/astrapi69/phylax/releases/tag/v1.0.0))

---

## Deployment

Public hosting of the PWA. Follows R-series; depends on v1.0.0 being
tagged so release notes can link to the live URL.

Note on prefix: the Phase 4 Documents tasks also use the `D-` prefix
(D-01 through D-10 for Document repository, upload, viewers, etc.). To
avoid ambiguity, Deployment tasks in this section are written with the
`[Deployment]` label alongside the task ID in commits and CHANGELOG.

- [x] **D-01** GitHub Pages deployment via Actions: conditional Vite base `/phylax/` in production, BrowserRouter basename from `import.meta.env.BASE_URL`, VitePWA `start_url`/`scope`/`navigateFallback` rebased, workflow_run trigger after CI, 404.html SPA fallback, playwright prod config updated (infra commit `eef1763`, docs follow-up `4d08e84`; live at https://astrapi69.github.io/phylax/)
- [ ] **D-02** Custom domain (optional; requires registrar + CNAME + DNS verification)
- [ ] **D-03** PWABuilder packaging for app stores (needs D-01 live URL)

---

## Internationalization (I18N-series)

Cross-cutting infrastructure to decouple user-facing strings from code
location. I18N-01 installs the runtime and extracts every hardcoded
German string into JSON namespaces feature-by-feature. User experience
stays unchanged at every step: app still works in German with the same
strings. I18N-02 adds English; P-11 extends to additional languages.

Prefix note: the `D-` prefix is shared with Phase 4 Documents and the
Deployment section. Commits and ROADMAP entries in this series carry
the `[I18N-01x]` label in commit messages and task IDs to keep scope
distinct.

- [x] **I18N-01a** Install and configure i18next infrastructure: deps
      (i18next + react-i18next; language-detector deferred to I18N-02 for
      bundle-size reasons while German is the only language), synchronous
      German loading, 15 empty namespace stubs, LanguageSwitcher (null
      render until multi-lang), contributing docs (commit `53070ea`)
- [x] **I18N-01b** Extract donation strings: 16 keys across 4 components, proactive plural forms for the reminder banner's month count, test setup synchronously initializes i18n (commit `56132b6`)
- [x] **I18N-01c** Extract settings strings: screen heading, theme radio group (Darstellung, Hell, Dunkel, System folgen), language-switcher label, settings-embedded export block (commit `19be817`)
- [x] **I18N-01d** Extract ai-config strings: AI-02 disclaimer (with I-04 BYOK + 30-day retention language), AISettingsSection (shell + UnconfiguredForm + ConfiguredForm + ProviderSelect), PrivacyInfoContent (3 sections, 12 bullets), PrivacyInfoPopover chrome (commit `8de7b25`)
- [x] **I18N-01e** Extract onboarding strings: 20 keys + typed ValidationError union (validatePassword returns `{kind:'empty'}` or `{kind:'too-short',min,length}`), ConfirmError flag for mismatch, UI resolves to i18n in view layer (commit `b32bb84`)
- [x] **I18N-01f** Extract unlock strings: 9 keys, typed UnlockError flag (`'wrong-password'`), dedicated `unlock` namespace (Option A duplication, one shared `password.label`) (commit `81e461f`)
- [x] **I18N-01g** Extract profile-view strings: 24 keys + typed ProfileViewError union (`not-found` / `generic{detail}`), basedata label/value split for i18n plural/unit agreement, detail preserved internally for logs, rendered UI unchanged (commit `9c23ad6`)
- [x] **I18N-01h** Extract views-bundle strings (observations, lab-values, supplements, open-points, timeline) into 5 dedicated namespaces; 5 hooks refactored to typed discriminated-union errors (`no-profile` / `generic{detail}`), views log raw detail and render translated fallback (matches I18N-01g pattern); SourceBadge moved to t-based lookup, SupplementsView drives category label via `t(\`category.${group.category}\`)` with hook returning domain-only data
- [x] **I18N-01i** Extract profile management namespaces (profile-list, profile-create): 14 + 17 keys; useProfileCreate refactored to flat `state.detail` (single failure mode, no discriminated union); ProfileList `formatCounts`/`profileTypeBadge` take `t` as parameter; only `counts.lab-report` uses i18next `_one/_other` plurals (matches existing manual plural), other count strings stay static to preserve byte-identical rendering; 3 profile-type keys byte-identical to profile-view (duplication accepted, hoist deferred)
- [x] **I18N-01j** Extract profile-import namespace (ImportFlow + 5 UI screens + ConfirmDialog + ImportCleanupScreen + CleanupButton + useImport hook): ~80 keys in hybrid structure (per-screen subtrees + shared `counts` + shared `action`); useImport refactored from `state.message` to `state.detail` (flat, single failure mode); ResultScreen failure path logs detail via console.error and renders translated fallback; ChatError mapping preserves `unknown-with-detail` interpolation (curated typed error from API client, not raw err.message - detail IS user-actionable content); ConfirmDialog owned within profile-import (grep confirmed no cross-feature usage); `action.cancel/back/next` + `counts.*` are strongest cross-namespace hoist candidates for I18N-01l
- [x] **I18N-01k** Extract ai-chat namespace (ChatView, ChatInput, StreamingIndicator, MessageBubble, CommitPreviewModal, GuidedSessionIndicator, useChat hook, commitFragment/versionDescription helpers): ~110 keys in hybrid structure (heading, welcome, header, input, streaming, message, guided, system, error.chat-error, commit-preview, commit-summary, version-description). 3 helper signatures changed to take `t` as first parameter (errorMessageFor, commitSummaryText, buildVersionDescription); CommitPreviewModal keeps `message: string` state shape with translated strings set at transition time (render-time translation deferred to language-switcher task). **Prompt-engineering content excluded:** GUIDED_SESSION_OPENING_MESSAGE and profileSummary Markdown headings stay hardcoded German (documented in lessons-learned.md). 9 byte-identical duplicates with entity namespaces flagged for I18N-01l hoist consolidation; 3 of 5 ChatError strings byte-identical with import.cleanup.chat-error.\*, 2 differ in wording
- [x] **I18N-01k-2** Reverse the I18N-01k prompt-engineering exclusion: extract `GUIDED_SESSION_OPENING_MESSAGE` (now `guided.opening-message`, single key with `\n`), `CONTEXT_FRAMING` (now `system.context-framing`), and all `formatProfileShareSummary` Markdown strings (~40 keys under `profile-summary.*` subtree including heading, base-data, observation, lab, supplement, open-point, warning-sign, and 12-month array via `returnObjects: true`). `formatProfileShareSummary(t, inputs)` signature; `toApiMessages(messages, framing)` signature. `openingMessage.ts` file removed; `CONTEXT_FRAMING` constant deleted; lessons-learned "prompt-engineering excluded" paragraph deleted. Rationale: Claude handles multilingual conversation history natively; switcher-consistency belongs to switcher design, not extraction. 4 new byte-identical duplicates (supplement category lowercase variants, now across 2 namespaces) added to I18N-01l hoist candidate list; `Grösse` (profile-view, umlaut) vs `Groesse` (profile-summary, ASCII) same-data spelling inconsistency added to the umlaut audit scope
- [x] **I18N-01l-a** Normalize umlauts to ASCII across 4 mixed-encoding locale files (import, profile-list, profile-view, settings); 20 JSON edits + 12 test assertion updates + 2 doc comments. Resolves 3 same-data cross-namespace mismatches (fuer/für, Grösse/Groesse, Auswählen/auswaehlen). Explicitly preserved: pattern matchers for incoming user data, test fixtures with real user content, ThemeToggle aria-label (scheduled for 01l-b). Precondition for 01l-c byte-identical hoist comparison. Bundle flat
- [x] **I18N-01l-b** Extract 5 remaining feature namespaces (app-shell, theme, pwa-update, documents, not-found); NAMESPACES 18 -> 23; 24 strings in 5 JSON files; NavBar uses `t(\`nav.${item.key}\`)`template pattern; ThemeToggle aria-label template normalized`für`->`fuer` (piggy-backed on 01l-a normalization rule). Flagged for 01l-c hoist: "Offene Punkte" now in 4 namespaces (≥3), "KI-Assistent" in 3 namespaces (≥3). Bundle -0.42 KB (label literals pulled from JS into JSON)
- [x] **I18N-01l-c** Create common namespace + hoist 7 cross-namespace duplicates (no-profile, cancel, close, counts.observations, counts.supplements, entity.open-points, entity.ai-assistant) plus `common.status.loading` (semantic-equivalence exception, 2-namespace router) plus 3 getDisplayName fallbacks (fallback-self, fallback-proxy, fallback-proxy-for). 29 JSON key deletes across 12 feature namespaces, ~30 call sites updated with `common:` qualifier, NavBar structural refactor to fully-qualified i18n paths per item, GuidedSessionIndicator ternary for open-points, getDisplayName signature extended to accept optional `t` parameter (defaults to initialized i18n instance). Router RequireProfile + ProtectedRoute extract `Laden...` directly to `common.status.loading`. Scope discovery: ExportDialog + ExportButton unextracted from earlier passes (9 strings + 1 button label) - extracted to export.json to satisfy exit criterion. Final grep sweeps A/B/B2 confirm zero hardcoded German UI chrome in src/ outside Markdown content output (markdownExport, wrapFragment, detectProfileFragment), AI prompt content (profileContext, formatProfileSummary), pattern matchers (NORMAL_ASSESSMENTS, parseProfile regex, LabValuesTable), and test fixtures
- [x] **I18N-01l** Parent entry complete: umlaut normalization (01l-a) + feature extractions (01l-b) + common hoist (01l-c) all shipped
- [x] **I18N-01** Series exit criterion achieved: zero hardcoded German UI chrome anywhere in src/ outside documented exceptions. 19 feature namespaces + 1 common namespace populated. Codebase ready for I18N-02 (English translations)
- [x] **I18N-02-prep** German-English terminology glossary (`docs/i18n-glossary.md`, ~80 terms with reasoning). Reference document for all 02-\* sub-commits and future ES/FR/EL translations
- [x] **I18N-02-a** Foundation EN translations: common, app-shell, theme, pwa-update, not-found, documents, onboarding, unlock, settings (base). 72 EN strings. DE plural split for `common.counts.observations` + `common.counts.supplements` (`_one`/`_other`, fixes count=1 grammar byproduct). `SUPPORTED_LANGUAGES` extended to `['de', 'en']` (i18next resource support); user-facing switcher gated behind new `LANGUAGE_SWITCHER_ENABLED` constant (stays false through 02-d). PreviewScreen + ProfileSelectionScreen tests updated from wrong-form `/1 Beobachtungen/` to correct singular `/1 Beobachtung/`. 5 new tests: 4 plural forms + 1 EN namespace registration
- [x] **I18N-02-b** Content EN translations: observations, lab-values, supplements, open-points, timeline, profile-view, profile-list, profile-create, export. 9 new EN JSON files. 3 DE plural splits (`profile-list.counts.open-points`/`versions`/`timeline-entries` -> `_one`/`_other`). Glossary extended with 14 entries across Core/Profile/Table/Common-actions sections. 7 new tests: 6 plural forms (3 keys x 2 languages) + 1 content-EN namespace registration. Main JS 211.55 -> 212.89 KB gzipped (+1.34 KB).
- [x] **I18N-02-c** ai-config + donation + import EN translations. 3 new EN JSON files (~136 strings). 8 DE plural splits in `import.json` (`preview.warnings-summary`, `preview.unrecognized-summary`, `confirm.lab-report-line`, `counts.open-points`, `counts.timeline-entries`, `counts.profile-versions`, `counts.warnings`, `counts.external-references`). Renamed `counts.warning-signs` -> `counts.warnings` to match the DE value semantic ("Warnhinweis" = generic parse warning, not medical warning sign); 1 call-site in `PreviewScreen.tsx` updated. Glossary +11 entries across Core/Profile/AI/Common-actions sections (total 110). 17 new tests: 16 plural forms (8 keys x 2 it-blocks for singular+plural) + 1 AI/support/import EN namespace registration. PreviewScreen + ConfirmDialog tests updated for count=1 DE grammar (`1 Warnung`, `1 nicht erkannter Block`, `1 Laborbefund`). Main JS 212.89 -> 214.85 KB gzipped (+1.96 KB).
- [x] **I18N-02-d** ai-chat EN translations. 1 new EN JSON file (~150 strings). 3 DE plural splits in `message.context.counts.*` (`abnormal-labs`, `open-points`, `warning-signs` -> `_one`/`_other`; MessageBubble.tsx call-sites already pass `count`). Glossary +9 entries across Core/AI/Common-actions (total 119). 7 new tests: 6 plural forms (3 keys x 2 it-blocks) + 1 ai-chat EN namespace registration. `errors` namespace left as reserved empty stub (actual error messages live in feature namespaces; namespace preserved for future catch-all). Main JS 214.85 -> 216.15 KB gzipped (+1.30 KB). Prompt-engineering strings (opening-message, context-framing, profile-summary headings) translated literally with intent preservation; accept any post-launch AI-behavior observation as empirical signal.
- [x] **I18N-02-e** Go-live. Custom detector (`src/i18n/detector.ts`, no npm package): localStorage `phylax-language` > `navigator.languages[0]` > 'en' fallback. German prefixes `de-*` + `gsw-*` (Swiss German). `LanguageSection` component replaces old `LanguageSwitcher` (deleted). Auto / Deutsch / English radio, literal option labels across both languages. `fallbackLng: false` (missing keys surface as raw keys instead of cross-language fallback). `src/test/pin-language.ts` pins DE as test-env default so existing DE-centric tests keep passing post-detector. 24 new tests (15 detector + 7 LanguageSection + 1 updated SettingsScreen + 1 updated config.test assertion). Main JS 216.15 -> 231.44 KB gzipped (+15.29 KB; unexpected larger than projection — likely Vite chunking regression where resources previously split are now inlined, investigate in Tech Debt). I18N-02 series complete.

---

## Phase S: Donation integration

Sustainability work. Makes donations discoverable without interrupting the core experience. All three tasks link out to `DONATE.md` in the repo root (Liberapay, GitHub Sponsors, Ko-fi, PayPal). No in-app payment processing, no analytics, no feature gating.

- [x] **S-01** Settings section "Phylax unterstuetzen" with an external link to DONATE.md (always visible, no state)
- [x] **S-02** One-time onboarding hint on ProfileView when `onboardingSeen=false`, dismissible via "Projekt unterstuetzen" or "Verstanden", remembered in localStorage
- [x] **S-03** 90-day reminder banner on the Profile view with three dismiss paths (support / not now / close), cooldown 90d after dismiss and 180d after donating

---

## Next Steps

Phases 1 through 3 plus Phase 2b/2c/2d, the I-series, and Phase S are
complete. The v1.0.0 public release is in progress via the R-series.

v1.0.0 shipped. D-01 (GitHub Pages deployment) landed. Verify live at
https://astrapi69.github.io/phylax/ once the `Deploy to GitHub Pages`
workflow completes for this commit, then update repo `homepageUrl` and
edit the v1.0.0 release notes to link the live URL.

Open backlog (deferred; not part of v1.0.0):

- **F-06b**: cross-browser Playwright (Firefox, WebKit)
- **O-10 through O-20**: editing forms (observation, lab value,
  supplement, open-point, base-data). Currently only read-only views exist.
- **IM-04**: auto-create a "Imported from file" profile version entry on
  successful import, land directly on the imported profile
- **IM-05**: import conflict handling beyond replace-all (selective merge)
- **Phase 4** (Documents) through **Phase 9** (Derived plans): all future

When a phase is complete:

1. Run the full test suite and fix any regressions.
2. Update CHANGELOG.md.
3. Tag a release per `release-workflow.md` (minor bump per phase, patch for fixes).
4. Move to the next phase.

## Technical Debt

- [ ] **TD-01** Bump GitHub Actions from @v4 to @v5 when released (Node.js 20 deprecation, June 2026 deadline)

## Out of scope (do not propose)

- Backend, server, cloud sync
- User accounts, login providers
- Own backend service for AI (calls go directly to provider)
- Wearable integrations
- ePA / FHIR / HL7 connectors
- Telemedicine, video calls
- Insurance claim submission
- Diagnosis features, decision support, triage scoring
- Medical advice, treatment recommendations, or interpretation of health data
