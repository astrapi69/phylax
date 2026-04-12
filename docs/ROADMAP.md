# Phylax Roadmap

This document is the source of truth for what to build next. Tasks are grouped by phase. Each task has an ID. When a task is finished, check its box and update the commit reference.

Task ID prefixes:

- **F** Foundation
- **E** Entries (CRUD for the five entry types)
- **D** Documents (file upload and storage)
- **X** eXport (PDF and CSV)
- **B** Backup and restore
- **P** Polish (UI, i18n, accessibility)
- **A** AI assistant (optional, opt-in)

---

## Phase 1: Foundation

Goal: a working PWA shell with master password, encryption layer, and an empty but functional database.

- [x] **F-01** Vite project setup with React 18, TypeScript strict, Tailwind, ESLint, Prettier
- [x] **F-02** Folder structure per `architecture.md` (`crypto/`, `db/`, `domain/`, `features/`, `ui/`, `i18n/`, `lib/`)
- [x] **F-03** ESLint rules: restrict `crypto.subtle` to `src/crypto/`, restrict `dexie` to `src/db/`
- [x] **F-04** Husky + lint-staged pre-commit hook
- [x] **F-05** Vitest setup with `fake-indexeddb`, sample test green
- [ ] **F-05b** Enable per-module coverage thresholds in vitest config (activate after F-11)
- [ ] **F-06** Playwright setup with one smoke test
- [ ] **F-07** Crypto module: AES-256-GCM encrypt/decrypt with round-trip and negative tests
- [ ] **F-08** Crypto module: PBKDF2 key derivation with salt, 600k iterations, constants in `crypto/constants.ts`
- [ ] **F-09** Key store module: in-memory key holder, lock/unlock API, no persistence
- [ ] **F-10** Dexie schema v1: `entries`, `documents`, `meta` tables
- [ ] **F-11** Generic encrypted repository base class (encrypt before put, decrypt after get)
- [ ] **F-12** Master password onboarding flow: set, confirm, derive key, store salt
- [ ] **F-13** Unlock flow: enter password, derive key, verify against test ciphertext
- [ ] **F-14** Auto-lock: configurable inactivity timeout, default 5 minutes, clears in-memory key
- [ ] **F-15** PWA config via `vite-plugin-pwa`: manifest, icons, service worker with autoUpdate
- [ ] **F-16** App shell: router, locked/unlocked state, basic layout
- [ ] **F-17** GitHub Actions CI: typecheck, lint, test, build on every PR
- [ ] **F-18** README with install instructions, threat model summary, screenshots

---

## Phase 2: Entries

Goal: full CRUD for all five entry types with list, detail, and search.

- [ ] **E-01** Domain types for all five entry types in `domain/entries/types.ts`
- [ ] **E-02** Entry validation rules (date sanity, required fields, length limits)
- [ ] **E-03** Entry repository: create, read, update, delete, list, all encrypted
- [ ] **E-04** Symptom entry: form, list item, detail view
- [ ] **E-05** Medication entry: form, list item, detail view, start/end date logic
- [ ] **E-06** Vital entry: form with type selector (BP, pulse, temp, weight, glucose, SpO2), unit handling
- [ ] **E-07** Appointment entry: form, list item, detail view
- [ ] **E-08** Note entry: free text with tags, form, list item, detail view
- [ ] **E-09** Unified timeline view: all entries sorted by date, type filter
- [ ] **E-10** In-memory search across decrypted entries (title, description, tags)
- [ ] **E-11** Date range filter
- [ ] **E-12** Empty states and loading skeletons
- [ ] **E-13** Edit and delete confirmations via modal, no `confirm()`

---

## Phase 3: Documents

Goal: upload PDFs and images, store them encrypted, view them, link them to entries.

- [ ] **D-01** Document repository: store encrypted blobs with metadata
- [ ] **D-02** File upload component with size limit (10MB per file) and type validation
- [ ] **D-03** Encrypted blob storage: chunk large files if needed
- [ ] **D-04** Document list view with thumbnails for images
- [ ] **D-05** PDF viewer (native browser PDF or `pdf.js` if bundling is acceptable)
- [ ] **D-06** Image viewer with zoom
- [ ] **D-07** Link documents to entries (one document, multiple entries possible)
- [ ] **D-08** Delete document with cascade check (warn if linked to entries)
- [ ] **D-09** Storage quota indicator (used vs available)
- [ ] **D-10** Request persistent storage via `navigator.storage.persist()` on first upload

---

## Phase 4: Export

Goal: generate a PDF report for a doctor visit, plus CSV export for power users.

- [ ] **X-01** PDF report generator with `jsPDF`: header, patient info section (user-editable), entries grouped by type
- [ ] **X-02** Date range selector for the report
- [ ] **X-03** Type filter for the report (include only selected entry types)
- [ ] **X-04** Include linked documents as appendix (or list them by name)
- [ ] **X-05** CSV export per entry type
- [ ] **X-06** Export preview before download
- [ ] **X-07** Filename convention: `phylax-report-YYYY-MM-DD.pdf`

---

## Phase 5: Backup and Restore

Goal: user can export an encrypted backup file and restore it on the same or another device.

- [ ] **B-01** Backup file format spec: header (version, salt, kdf params), encrypted payload, checksum
- [ ] **B-02** Backup export: serialize all entries and documents, encrypt with master password (separate key derivation), download
- [ ] **B-03** Backup import: file picker, read header, prompt for password, decrypt, verify checksum
- [ ] **B-04** Restore flow: warn about overwrite, confirm, replace local DB
- [ ] **B-05** Merge mode (optional): import without overwriting existing entries by ID
- [ ] **B-06** Backup encryption uses its own salt, independent from the live key
- [ ] **B-07** End-to-end test: create entries, export, wipe, import, verify identical state
- [ ] **B-08** Optional seed-phrase recovery: BIP39 wordlist, derive key from phrase, document tradeoffs

---

## Phase 6: Polish

Goal: production-quality UX, mobile-ready, accessible, internationalized.

- [ ] **P-01** Mobile-first responsive review of every screen at 360px, 768px, 1024px
- [ ] **P-02** Dark mode via Tailwind `dark:`, system preference detection, manual override
- [ ] **P-03** i18next setup with DE and EN translations
- [ ] **P-04** Onboarding tour: explain local-first, encryption, no cloud, threat model in plain language
- [ ] **P-05** Settings screen: auto-lock timeout, language, theme, change master password
- [ ] **P-06** Change master password flow: re-encrypt all records with new key
- [ ] **P-07** Accessibility audit: keyboard navigation, screen reader labels, focus management
- [ ] **P-08** Performance audit: bundle under 250KB gzipped, TTI under 3s on mid-range phone
- [ ] **P-09** Error boundary with friendly message and recovery option
- [ ] **P-10** Toast system for user feedback (success, warning, error)
- [ ] **P-11** Add ES, FR, EL translations (matching the developer's language background)
- [ ] **P-12** Privacy policy and license page in-app

---

## Phase 7: AI Assistant (optional, opt-in)

Goal: a structured symptom-capture chat using the user's own API key. Off by default, never required.

This phase is OPTIONAL and only starts after Phase 6 is complete and stable. It is the only phase that touches an external API. Users must explicitly opt in and provide their own key.

- [ ] **A-01** Settings: opt-in toggle, API key input (encrypted in storage), provider selection (OpenAI / Anthropic)
- [ ] **A-02** Disclaimer screen on first activation: not medical advice, data leaves device, user controls key
- [ ] **A-03** System prompt with strict guardrails: structured symptom capture only, no diagnosis, no treatment recommendations
- [ ] **A-04** Chat UI with clear "AI assistant" labeling on every message
- [ ] **A-05** Convert chat output into a draft entry (symptom or note), user reviews before saving
- [ ] **A-06** Network call only when chat is actively used, no background calls
- [ ] **A-07** Local audit log of API calls (timestamp, token count, no payload)
- [ ] **A-08** Rate limit and cost warning if usage spikes
- [ ] **A-09** One-click disable: removes API key, removes audit log, restores Phase 6 behavior

---

## Next Steps

The first task to work on is **F-01**. Confirm this before starting.

When a phase is complete:

1. Run the full test suite and fix any regressions.
2. Update CHANGELOG.md.
3. Tag a release per `release-workflow.md` (minor bump per phase, patch for fixes).
4. Move to the next phase.

## Out of scope (do not propose)

- Backend, server, cloud sync
- User accounts, login providers
- Multi-user on a single install
- Wearable integrations
- ePA / FHIR / HL7 connectors
- Telemedicine, video calls
- Insurance claim submission
- Diagnosis features, decision support, triage scoring
