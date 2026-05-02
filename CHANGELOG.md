# Changelog

All notable changes to Phylax will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### AI assistant

- Multi-AI-Provider support (AIP-01..05): the AI assistant now talks to seven provider presets (Anthropic, OpenAI, Google, Mistral, LM Studio, Ollama, custom) through a multi-adapter `LLMClient` (Anthropic native + OpenAI-compatible). New `aiStream` helper at `src/features/ai/aiCall.ts` unifies streaming text across providers and replaces the deleted `streamCompletion` / `anthropicClient.ts`; `useChat` and `requestCleanup` migrate transparently. Storage-layer change: `MetaPayload.aiConfig` evolves from a single `AIProviderConfig` to `MultiProviderAIConfig = { providers: AIProviderConfig[]; activeProviderId }`; legacy single-shape vaults migrate automatically on read with a defence-in-depth parser (malformed entries dropped, duplicate ids deduplicated last-wins, `activeProviderId` repaired when it points outside the list). UI-layer change: AISettingsSection is now a 230-LOC summary view with provider label + masked API key + model + "Anbieter verwalten" / "KI deaktivieren" buttons; the new three-step `AiSetupWizard` mounts via `React.lazy` + `Suspense fallback={null}` so the wizard chunk only ships when the user clicks. CORS-blocked providers (OpenAI, Mistral) save with a clear amber warning on wizard step 2 explaining that browser-direct calls require a proxy Phylax does not yet provide. Decision A2 keeps `requestCompletion` + `tool_use` Anthropic-only because cross-provider tool-call protocols differ; a generic structured-output abstraction is a deliberate future task. Foundation reused: master-password-derived AES-GCM-256 key (ADR-0001), encrypted `meta.payload` blob, ADR-0018 P-06 reencryption pipeline (multi-provider AI config rides along, no `TABLES_TO_REENCRYPT` change). Architecture documented in ADR-0019; manual smoke at `docs/manual-smoke/ai-multi-provider.md`.

#### Documents and import

- Phase 4 - Document management (D-01..D-10): encrypted attached-document storage (PDFs, images), inline viewer with image / PDF rendering paths, link / unlink to observations and lab values, persistent-storage banner and quota indicator, mobile-first list with pagination, delete with cascade warning.
- Phase 4b - ePA / document import (IMP-01..06): user uploads a PDF, image, or insurer-app export; the AI classifies the document type, extracts structured entries (observations / lab values / supplements / open points) with per-field provenance back to the source document. Per-type review screen with merge / replace / skip toggles; commit transaction is atomic (ADR-0017 PDF stack). Source-document upload preserved alongside the extracted entries.
- IM-04 auto-version-entry: the markdown importer now emits a profile-version entry automatically per import so the version history reflects the AI-assisted timeline without manual tracking.
- IM-05 per-type replace toggles plus Option B merge dialog: import-replace dialog gained per-entity-type Add / Replace / Skip toggles; Option B merge UX rewrite landed 2026-05-01 (commit `8e93964`) so the dialog reads "Import in bestehendes Profil" with each row gating the confirm button until a mode is chosen.

#### Export

- Phase 5 - Multi-format export (X-01..X-08): Markdown export (X-01), PDF export with date-range filter (X-02 / X-03, ADR-0020 jspdf-autotable), theme whitelist (X-04), linked-documents appendix (X-05), CSV export of lab values (X-06), live preview before download (X-07), per-format save-as flow (X-08). All export paths run through the same `useExportData` hook so filters apply uniformly.

#### Backup and restore

- Phase 6 - Encrypted backup round-trip (B-01..B-04, B-06, B-07): single-file `.phylax` backup encrypted under the current master key with vault-version metadata, manifest, and per-table ciphertext blocks; restore validates the manifest, decrypts every block under the typed password, and bulk-puts atomically into a fresh database via the same Dexie transaction primitive used for import. Source documents and provenance metadata round-trip.

#### Onboarding

- Phase ONB - Onboarding UX restructure (ONB-01a..f): split the master-password setup into a paced multi-step flow with explicit consent boxes, masked API-key field, recovery-warning copy, and zxcvbn strength meter inline (ADR-0014). Replaces the original single-screen onboarding from F-12.

#### Phase 7 polish

- Phase 2 manual-entry CRUD (O-10..O-19) and the shared modal primitive (O-20): every entity (observation, lab value, supplement, open point, document) now supports manual create / edit / delete via inline forms backed by the shared `<Modal>` and `<ConfirmDialog>` primitives at `src/ui/Modal/`.
- Mobile-first viewport sweep (P-01) with manual-smoke artifact at `docs/manual-smoke/p-01-mobile-sweep.md`.
- Auto-lock presets (P-05): Settings section gains 1 / 5 / 15 / 30-minute presets plus a "never" toggle (with a security warning); the configurable timeout from F-14 stays the source of truth.
- Polish series P-07-a/b/c: focus-trap regressions, reduced-motion honour for scroll-into-view, and consistent button hit-targets at 360 px.
- Time-to-interactive perf pass (P-08): trim setup-chunk imports, defer non-critical lazy chunks behind user intent.
- Top-level error boundary (P-09): single React class component at `src/ui/ErrorBoundary.tsx` mounted in `src/main.tsx` between StrictMode and the theme provider. Catches render-phase errors from any descendant and shows a localized friendly fallback with two recovery actions (Reload + Go-Home) plus a collapsible `<details>` block carrying error message + stack + component stack so users can copy-paste the diagnostic into a manual bug report. `console.error` for dev visibility; no telemetry per CLAUDE.md (no Sentry, no auto-submission). Per-route boundaries deferred until a concrete failure mode justifies them. Manual smoke at `docs/manual-smoke/p-09-error-boundary.md`.
- Change master password (P-06): re-encrypts the entire vault under a new key via a three-phase pipeline (decrypt-encrypt outside Dexie tx, atomic bulkPut + meta.put inside one transaction, in-memory keyStore swap). Settings section + confirmation modal + busy-state UI; sudo-pattern verification re-derives the candidate key from the typed current password and decrypts the meta verification token before any work begins. Auto-lock paused for the duration via a new reference-counted pause primitive (`src/features/auto-lock/pauseStore.ts`) reusable for backup-restore and other long-running operations. Same salt preserved (PBKDF2 does not need salt rotation per password). Manual smoke at `docs/manual-smoke/p-06-change-password.md`.
- License footer (P-12): MIT-license link in the app footer.
- Trigger criteria for deferred polish markers (P-13 / P-14 / P-15): each carries an explicit "ship when X happens" line in the ROADMAP.
- Inline document-row delete (P-16): `/documents` list rows now carry a 44 x 44 trash-icon button as a sibling of the navigation `<Link>` (avoids the WCAG nested-interactive violation O-10 surfaced). Trigger opens the same destructive `<ConfirmDialog>` used on the viewer page, with cascade-warning copy for documents linked to observations or lab values. On confirm the row vanishes via an `onDeleted` callback that bumps the `versionKey` on `DocumentList`. Aria-label on the trigger names the filename so screen-reader users disambiguate across rows. Manual smoke at `docs/manual-smoke/p-16-document-row-delete.md`.
- ResetDialog migration to the shared modal primitive (P-17).
- Highlighted-match polish across search views (P-19).
- Cross-feature search and row-level match navigation (P-22a/b/c/d): instant search across observations, lab values, supplements, open points, documents. P-22b/c/d adds Up / Down chevrons next to the match counter; Enter / Shift-Enter on the search input drives the same. Each rendered row / group carries a `data-match-row` attribute; clicking a chevron scrolls the next matched row into view via `scrollIntoView({ block: 'center' })` honouring `prefers-reduced-motion` (P-07-c precedent). Counter switches to "{current} von {total} Treffer" while nav active (matches Observations UX). `useActiveMatch` lifted to `src/lib/`; `MatchNavButton` extracted to `src/ui/` for reuse across all four search views. Manual smoke at `docs/manual-smoke/p-22-b-c-d-match-nav.md`.

#### Internationalisation

- I18N-02 series (a..e): English translations of every namespace plus the runtime auto-detection switcher; v1.0.0's German UI is now bilingual at runtime with a manual override.

#### User documentation

- DOC-01 Iteration 1 (e): user-facing documentation site at https://astrapi69.github.io/phylax-docs/ with parallel DE+EN content covering Getting Started, Daily Use, Backup, FAQ, and Background.

### Changed

- Service-worker update mode flipped from `autoUpdate` (with a "New version available, reload" toast) to `registerType: 'prompt'` + `skipWaiting: true` + `clientsClaim: false` (BUG-01, third iteration). Users get the new version on the next reload silently; the regression-guard test at `src/pwa/viteConfigPwa.test.ts` locks the option set.
- App-shell navigation replaced the bottom-nav with a hamburger drawer (BUG-02) so the navigation surface scales with screen height instead of competing with mobile keyboard insets.
- Toolchain refresh (DEPS-01..03 + ADR-0021): React 18 -> 19.2.5 (ADR-0021), TypeScript -> 6, Vite 6 -> 7, Vitest 3 -> 4 (coverage thresholds recalibrated in ADR-0016), Tailwind 3.4 -> 4, Node 22.12 floor then bumped to Node 24 to match the runtime in CI. No source changes were required for the React major.
- Locked dependency list in `.claude/rules/coding-standards.md` aligned with `package.json`: `pdfjs-dist` (ADR-0017), `jspdf-autotable` (ADR-0020), and the tooling shims (`@eslint/js`, ESLint plugins, type packages, Tailwind PostCSS bridge, `@resvg/resvg-js`) are now declared.
- Bundle-budget table in `.claude/rules/quality-checks.md` now includes the pdf.js (130 KB) and jsPDF (140 KB) lazy-chunk slots that ship with Phase 4b and Phase 5.
- Em-dash sweep across `src/`, `docs/`, and the user-facing locale strings: ~200 occurrences replaced per the no-em-dash rule in CLAUDE.md.

### Fixed

- BUG-01 silent service-worker updates (3 iterations): regressions caused by the original `autoUpdate` toast confused users; the prompt-mode silent-update model resolves them.
- BUG-02 hamburger drawer: replaces the bottom-nav that broke on mobile keyboard.
- BUG-03 / 04 / 05 / 06 documents fixes: linked-entity surfacing, delete-cascade visibility, viewer focus-trap, MIME-type detection edge cases.
- BUG-07 / 08 / 09 / 10 ai-config fixes: API-key masking via CSS (BUG-10), dropdown timing on the wizard, settings refresh after save (BUG-08), webkit-on-CI smoke regressions, plus general resilience around config persistence.
- E2E production-build regressions: webkit zxcvbn timing on `Phylax einrichten` button, import-confirm dialog heading rename, and the webkit driver bug on navigation while offline (skipped on webkit; chromium and firefox cover the offline-cache contract).

### Security

- Architecture decision: ADR-0019 documents the Multi-AI-Provider architecture: adapter pattern via `LLMClient`, Phylax crypto reuse (no parallel encryption pipeline), Decision A2 streaming-vs-structured-output split, single-shape -> multi-shape migration on read with idempotent defence-in-depth, lazy-load wizard, and the donor extraction lessons (two donor bugs caught and fixed during integration: `verifyOpenAI` AbortError swallow -> re-throw, `LLMClient.postJson` AbortError wrap -> re-throw). Multi-provider AI configurations ride on the existing encrypted `meta.payload` blob; the ADR-0018 P-06 reencryption pipeline handles them automatically without a `TABLES_TO_REENCRYPT` change.
- Architecture decision: ADR-0018 documents the change-master-password three-phase pipeline, the sudo-pattern verification, the same-salt rationale, the reference-counted auto-lock pause, the no-cancellation policy, the Phase 2 commit + Phase 3 throw recovery path, and the deferred memory-streaming trigger.
- Architecture decision: ADR-0017 introduces `pdfjs-dist` for client-side PDF parsing in the Phase 4b document-import pipeline; bundling the worker (no CDN fetch at runtime) preserves the no-third-party-network-call posture.
- Architecture decision: ADR-0020 introduces `jspdf-autotable` for tabular sections of the PDF export; co-loaded with jsPDF in the same lazy chunk; no new external resources.

### Technical-debt cleanups

- TD-02 React 19 upgrade (now backfilled as ADR-0021).
- TD-03 / 04 / 05 / 06 / 07 toolchain modernisation (DEPS-01..03 + Vitest 4 coverage recalibration via ADR-0016).
- TD-12 modal sweep: seven dialog migrations onto the shared `<Modal>` / `<ConfirmDialog>` primitive (O-20) so all destructive flows share the same focus-trap and escape semantics.

## [1.0.0] - 2026-04-18

First public release. Phylax is a privacy-first, local-first health profile
Progressive Web App. All data is encrypted on your device; there is no
backend, no cloud, no telemetry. AI features are opt-in and use the user's
own Anthropic API key.

### Added

#### Data management

- Encrypted local storage with AES-256-GCM per record, PBKDF2-SHA256 key derivation at 1.2 million iterations, in-memory master key cleared on lock or page close (F-07, F-08, F-09)
- Master password onboarding flow, unlock with salt verification, and auto-lock after 5 minutes of inactivity (F-12, F-13, F-14)
- Encrypted IndexedDB schema via Dexie with eight tables (profiles, observations, lab values, supplements, open points, profile versions, documents, meta); every entity carries a profileId from day one (F-10, F-11)
- Domain model for self and proxy profiles, observations (fact / pattern / self-regulation / status), lab values, supplements, open points, timeline entries, and profile versions (O-01 to O-09)
- Generic encrypted repository base class that encrypts before put and decrypts after get, with repository implementations for every entity (F-11, O-03 to O-08)
- Tolerant markdown importer for the "Lebende Gesundheit" format with parse warnings, unrecognized-block tracking, and bulk-put transaction (IM-01, IM-02, IM-03a, IM-03b)

#### Views and UI

- App shell with routing, locked and unlocked states, protected routes (F-16)
- Profile overview view at /profile showing base data, diagnoses, medications, relevant limitations, warning signs, external references, and context notes (V-01)
- Observations view grouped by theme with alphabetical and recent-first sort modes, plus post-commit highlight so AI updates surface immediately (V-02, V-02b)
- Lab values view with per-report tables, category assessments, and reference ranges (V-03)
- Supplements view grouped by category (daily / regular / on-demand / paused) with rationale display (V-04)
- Open points checklist view grouped by context, with priority and time-horizon badges (V-05)
- Timeline view rendering chronological entries with markdown bodies (V-06)
- Dark mode with system-preference detection, manual override, and flash-prevention inline script for first render (T-01a, T-01b)
- Mobile-first responsive layout across all screens (no horizontal scroll at 360 px width)

#### AI assistant

- Optional AI structuring partner via Anthropic Claude with bring-your-own-API-key model; key stored encrypted, never transmitted to a Phylax server (AI-01, AI-11)
- Activation disclaimer that must be accepted before the key is persisted; disclaimer acceptance remembered in localStorage (AI-02)
- System prompt contract: structures user input, never diagnoses, never interprets lab values clinically, flags uncertainty, emits profile updates in a parser-compatible markdown format (AI-03)
- Proxy-profile system prompt extension that distinguishes observed versus reported information and adapts caregiver-perspective language (AI-04)
- Ephemeral chat UI with streaming responses, "Profil teilen" context sharing, and clear assistant labeling; chat messages never persist to storage (AI-05, AI-10)
- Structured-fragment detection that recognizes Phylax-format blocks in AI replies and surfaces a one-click "In Profil uebernehmen" button (AI-07)
- Commit preview modal with field-level diff, three-bucket display (new / changed / unchanged), version-description input, and tolerant merge semantics (AI-08)
- Guided session mode that walks the user through observations, supplements, and open points in sequence with progress pills and inline end-confirmation (AI-06)
- AI-assisted cleanup fallback when the markdown parser cannot read pasted input; routes cleaned output through the normal import flow on success, surfaces the raw AI output when cleanup still fails (AI-09)

#### Progressive Web App

- Installable PWA via vite-plugin-pwa with autoUpdate service worker and Workbox precaching (F-15)
- Complete icon set: standard icons at 72, 96, 128, 144, 152, 192, 384, and 512 pixels; maskable variants at 192 and 512 for Android adaptive icons; 180 px Apple touch icon; 32 px favicon (R-01)
- Manifest metadata: lang=de, dir=ltr, categories=[health, productivity], theme and background colors, portrait orientation preference (R-01)
- Regeneration pipeline via @resvg/resvg-js (pure WASM) wired to `make icons`; SVG masters in public/icons/ are the single source of truth (R-01)

#### Accessibility

- WCAG 2.1 AA compliance via axe-core checks integrated into the production E2E suite; zero violations across the smoke matrix (T-02a, T-02b)
- Keyboard navigation and focus management across modals and the chat interface (commit-preview modal, privacy popover, cleanup screen)
- ARIA labels on structural controls, aria-live regions for chat streaming and guided-session progress

#### Donation integration

- Settings section "Phylax unterstuetzen" with an always-visible external link to DONATE.md (Liberapay, GitHub Sponsors, Ko-fi, PayPal) (S-01)
- One-time onboarding hint on the Profile view, dismissible via "Projekt unterstuetzen" or "Verstanden" and remembered in localStorage (S-02)
- 90-day reminder banner on the Profile view with three dismiss paths (support, not now, close), with cooldown heuristics (90 days after dismiss, 180 days after donating) (S-03)

#### Documentation

- Public-release README with features list, privacy summary, AI opt-in walkthrough, screenshot placeholders tracked as issues, and acknowledgments (R-02)
- DONATE.md with four support options and Liberapay highlighted as recommended
- Architectural Decision Records under docs/decisions/ (ADR-0008 dependencies, ADR-0009 flash-prevention script, ADR-0010 size-limit budgets, ADR-0011 mutation testing strategy)
- Living-health concept documentation at docs/CONCEPT.md (German) covering data model, AI role, and threat model

### Security

- All health data encrypted before persistence to IndexedDB; the crypto module is the only call site for the Web Crypto API, enforced by ESLint (F-03, F-07)
- Dexie imports restricted to src/db/ so no UI code can reach the database directly, enforced by ESLint (F-03)
- No telemetry, no analytics, no error reporting services; network calls only fire on user-initiated AI requests (AI-10)
- Key store holds the derived CryptoKey in a module-level variable only; never written to disk, cleared on auto-lock (F-09, F-14)
- Auto-lock default of 5 minutes, configurable by the user (F-14)
- Precise data-retention disclosure: the in-app disclaimer and the "Datenschutz beim KI-Chat" popover name the 30-day Anthropic retention window, the no-training guarantee, and the user-owned API key model; link out to privacy.claude.com (I-04)
- One-click disable removes the API key and deactivates all AI features without affecting stored profile data (AI-11)

### Technical

- Node 20 LTS requirement with .nvmrc and engines field; CI matrix covers Node 20 and Node 22 (I-01)
- 1096 unit tests (Vitest with fake-indexeddb) and 95 production E2E tests (Playwright against the built bundle)
- Three-layer architecture (UI / domain / storage) with ESLint-enforced import boundaries
- Per-module coverage thresholds enforced in CI only (not locally) to avoid the instrumentation cost on developer machines (I-03)
- Mutation-testing thresholds enforced by nightly CI: crypto 95 percent (100 percent baseline), repositories 95 percent (100 percent baseline), parser 55 percent (57.81 percent baseline), import 75 percent (81.16 percent baseline) (T-04a, T-04c, T-04e, T-04f, T-04g, T-04h)
- Bundle-size budget of 180 KB gzipped for the main JS bundle, enforced by size-limit in CI; current 177.99 KB (T-03)
- Rules framework under .claude/rules/ covering architecture, coding standards, quality checks, release workflow, and AI workflow (I-02)

## Notes on pre-1.0 history

Earlier development history is available in the git log; the v1.0.0 release
is the baseline for SemVer going forward. Future changes land in
[Unreleased] above, and each release bumps according to
[Semantic Versioning](https://semver.org/).
