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

---

## Phase 1: Foundation

Goal: a working PWA shell with master password, encryption layer, and an empty but functional database.

- [x] **F-01** Vite project setup with React 18, TypeScript strict, Tailwind, ESLint, Prettier
- [x] **F-02** Folder structure per `architecture.md` (`crypto/`, `db/`, `domain/`, `features/`, `ui/`, `i18n/`, `lib/`)
- [x] **F-03** ESLint rules: restrict `crypto.subtle` to `src/crypto/`, restrict `dexie` to `src/db/`
- [x] **F-04** Husky + lint-staged pre-commit hook
- [x] **F-05** Vitest setup with `fake-indexeddb`, sample test green
- [ ] **F-05b** Enable per-module coverage thresholds in vitest config (activate after F-11)
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
- [ ] **F-15** PWA config via `vite-plugin-pwa`: manifest, icons, service worker with autoUpdate
- [ ] **F-16** App shell: router, locked/unlocked state, basic layout
- [ ] **F-17** GitHub Actions CI: typecheck, lint, test, build on every PR
- [ ] **F-18** README with install instructions, threat model summary, screenshots

---

## Phase 2: Profile

Goal: the living medical profile as core artifact. Observation CRUD grouped by theme, profile versioning, markdown rendering.

- [ ] **O-01** Domain types for profile, observation (fact/pattern/self-regulation/status), lab value, supplement, open point, profile version in `domain/`
- [ ] **O-02** Validation rules for observations (required fields, theme non-empty, status enum)
- [ ] **O-03** Profile repository: create default profile on first unlock, read, update base data
- [ ] **O-04** Observation repository: create, read, update, delete, list by theme, all encrypted
- [ ] **O-05** Lab value repository: create, read, update, delete, list by date, all encrypted
- [ ] **O-06** Supplement repository: create, read, update, delete, list, all encrypted
- [ ] **O-07** Open point repository: create, read, update (toggle), delete, list, all encrypted
- [ ] **O-08** Profile version repository: create version entry on every profile change, list history
- [ ] **O-09** Profile view: render the full profile as structured markdown
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

## Phase 3: AI-Guided Input

Goal: AI as primary input method for profile creation and updates. User provides fragments, AI structures them into the profile format.

- [ ] **AI-01** Settings: API key input (OpenAI / Anthropic), encrypted in storage, provider selection
- [ ] **AI-02** Disclaimer on first activation: not medical advice, data leaves device to AI provider, user controls key
- [ ] **AI-03** System prompt implementing the prompt contract: structure only, no diagnosis, mark uncertainties, use observation model (fact/pattern/self-regulation)
- [ ] **AI-04** Extended system prompt for proxy profiles: mark caregiver-perspective, distinguish observed vs. reported
- [ ] **AI-05** Chat UI: ephemeral messages (not persisted), clear "AI assistant" labeling
- [ ] **AI-06** Guided profile session flow: AI walks user through profile sections (base data, observations, lab values, supplements, open points)
- [ ] **AI-07** Structured output: AI produces markdown profile fragment at end of session
- [ ] **AI-08** Review and commit flow: user reviews AI output, edits if needed, commits to profile with version entry
- [ ] **AI-09** Paste-in mode: user pastes markdown from external AI session, Phylax parses and imports into profile sections
- [ ] **AI-10** Network call only when chat is actively used, no background calls
- [ ] **AI-11** One-click disable: removes API key, disables AI features, manual mode only

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

## Next Steps

The next task to work on is **F-08**. Confirm this before starting.

When a phase is complete:

1. Run the full test suite and fix any regressions.
2. Update CHANGELOG.md.
3. Tag a release per `release-workflow.md` (minor bump per phase, patch for fixes).
4. Move to the next phase.

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
