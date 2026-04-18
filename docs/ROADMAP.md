# Phylax Roadmap

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

- [ ] **X-01** Markdown export: render the full profile as a single `.md` file for download
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

- [ ] **B-01** Backup file format spec: header (version, salt, kdf params), encrypted payload, checksum
- [ ] **B-02** Backup export: serialize all profile data and documents, encrypt with master password (separate key derivation), download
- [ ] **B-03** Backup import: file picker, read header, prompt for password, decrypt, verify checksum
- [ ] **B-04** Restore flow: warn about overwrite, confirm, replace local DB
- [ ] **B-05** Merge mode (optional): import without overwriting existing data by ID
- [ ] **B-06** Backup encryption uses its own salt, independent from the live key
- [ ] **B-07** End-to-end test: create profile with observations, export, wipe, import, verify identical state

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
- [ ] **P-08** Performance audit: bundle under 250KB gzipped, TTI under 3s on mid-range phone
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
- [x] **R-03** CHANGELOG.md with Keep-a-Changelog format, grouped by user-facing category with task-ID traceability (commit pending)
- [ ] **R-04** GitHub repo metadata: description, topics, social preview
- [ ] **R-05** v1.0.0 git tag and GitHub Release

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

Current active task: **R-04** (GitHub repo metadata). Remaining release
tasks: R-04 -> R-05.

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
