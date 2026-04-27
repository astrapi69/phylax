# Phylax

Your local-first, zero-knowledge living health profile.

**Live demo**: https://astrapi69.github.io/phylax/ (install as a PWA via your browser's address bar)

**User documentation**: https://astrapi69.github.io/phylax-docs/ (Iteration 1 complete; DE+EN parallel content covering Getting Started, Daily Use, Backup, FAQ and Background)

[![CI](https://github.com/astrapi69/phylax/actions/workflows/ci.yml/badge.svg)](https://github.com/astrapi69/phylax/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bundle budget](https://img.shields.io/badge/bundle-%3C180%20KB-blue)](./size-limit.json)
[![Donate using Liberapay](https://img.shields.io/liberapay/patrons/astrapi69.svg?logo=liberapay)](https://liberapay.com/astrapi69/donate)

## What is Phylax

Phylax (Greek: phylax, "guardian") is a personal, data-sovereign health
platform built as a Progressive Web App. All data stays on your device,
encrypted with a master password you choose. There is no backend, no cloud,
no telemetry, and no data collection.

The core artifact is a **living medical profile**: a versioned, structured
document where you record observations about your health, grouped by theme
(for example "Shoulder", "Nutrition", "Blood pressure"). Each observation has
three facets: what happened (fact), what recurs (pattern), and what you
decided to do about it (self-regulation). The profile also tracks lab values,
supplements, and open questions for your next doctor visit.

Phylax supports AI-guided profile creation: you provide fragments (lab photos,
medication names, verbal observations), and an AI structures them into your
profile using your own API key (Anthropic Claude). The AI operates under a
strict contract: it structures, it does not diagnose. You can also enter data
manually or paste markdown from an external AI session.

The name comes from the Greek phylax (guardian). Phylax is not a doctor, not
a database, but a guardian of your health narrative.

## Who is Phylax for

- Privacy-conscious individuals tracking their own health profile
- Caregivers tracking dependents (elderly parent with dementia, child)
- Anyone preparing for doctor visits with structured, fact-based notes
- Developers interested in local-first, zero-backend PWA architecture

Phylax is primarily designed for German-speaking users; the UI is in German.
The documentation (this README, ADRs) is in English. A German-to-English UI
translation is on the roadmap.

## Screenshots

![Profile view](./docs/screenshots/profile.png)

<!-- TODO: Screenshot showing the Profile overview with BaseData, diagnoses, warning signs (light mode) -->

![Observations grouped by theme](./docs/screenshots/observations.png)

<!-- TODO: Observations view with 2-3 themes expanded showing fact / pattern / self-regulation fields -->

![AI chat mid-session](./docs/screenshots/ai-chat.png)

<!-- TODO: Chat view with a user message and an assistant reply containing a ### [Thema] block plus the "In Profil uebernehmen" button -->

![Settings with AI config](./docs/screenshots/settings.png)

<!-- TODO: Settings screen showing the AI-Assistent section with a masked API key and the donation section -->

## Features

- **Encrypted local storage**: AES-256-GCM per record, PBKDF2-SHA256 with
  1.2 million iterations, in-memory master key only (never written to disk)
- **Living health profile**: observations grouped by theme, lab values,
  supplements, open points, timeline entries, profile versioning
- **Markdown import**: tolerant parser for the "Lebende Gesundheit" format,
  with an AI-assisted cleanup fallback when the input does not match
- **Read-only views** per entity type with alphabetical and recent-first
  sorting
- **AI assistant** (optional, bring your own Anthropic API key):
  - Structuring partner only; never diagnoses, never interprets lab values
  - Share profile context into the chat without losing messages between turns
  - Commit preview with diff view and field-level merge
  - Guided session mode that walks three profile sections systematically
  - Parser fallback: reformat unparseable markdown via one-click cleanup
- **Progressive Web App**: installable, works offline, autoUpdate service
  worker
- **Accessibility**: WCAG 2.1 AA via axe-core checks in the production E2E
  suite
- **Dark mode** with system-preference detection
- **German UI** (i18next-ready for English translation)

## Origin

Phylax implements the "Living Health" concept by Asterios Raptis, a four-part
Medium series arguing that health is a user-led process, not a state managed
by others.

**English:**

- Part 1: [Living Health: From Patient to Partner](https://asterios-raptis.medium.com/living-health-from-patient-to-partner-9fff311a8c45)
- Part 2: [Living Health in Practice](https://asterios-raptis.medium.com/living-health-in-practice-d53964053500)
- Parts 3-4: Translation in progress

**Original German:**

- [Lebende Gesundheit - Die Serie](https://asterios-raptis.medium.com/lebende-gesundheit-die-serie-0193f66df9a3)

The four parts cover:

1. Concept: health as a user-led process, not a managed state
2. Self-application: observe, pattern, self-regulate
3. Caregiver profiles (elderly parent, dependent child)
4. AI as a structuring partner, not a diagnostician

Phylax is the practical implementation: a tool for carrying out steps 2-4 in
daily life.

## Not a medical device

Phylax is a personal data management tool. It does not provide medical
advice, diagnosis, or treatment recommendations.

AI in Phylax structures, it does not diagnose. The AI organizes what you
bring in. It does not interpret your health data, recommend treatments, or
replace professional medical judgment.

If you are experiencing a medical emergency, contact your doctor or call
emergency services immediately.

Phylax helps you organize and store your own health records. Nothing more.

## Security

Phylax encrypts all health data before writing it to the browser's
IndexedDB:

- **AES-256-GCM** encryption per record, with a unique 12-byte IV per write
- **PBKDF2-SHA256** key derivation with 1.2 million iterations from your
  master password
- **In-memory key only**: the derived key is never written to disk. It lives
  in memory while the app is unlocked and is cleared on lock or page close.
- **Auto-lock** after 5 minutes of inactivity (configurable)
- **No network calls** except user-initiated AI requests with the user's own
  API key

**Phylax protects against:**

- An attacker reading your IndexedDB without the master password (encrypted
  at rest)
- Network eavesdropping (no network used; everything is local)
- Cloud provider access (no cloud)
- App developer access (no telemetry, no remote management)

**Phylax does NOT protect against:**

- Keyloggers or malware on your device
- Malware reading your screen while Phylax is unlocked
- Physical coercion to reveal your master password
- A forgotten master password (no recovery; data is lost)
- A compromised browser or operating system

For the full security model, see [docs/CONCEPT.md](docs/CONCEPT.md).

## Privacy summary

- **Nothing leaves your device** unless you explicitly use the AI features.
- **AI requests go directly from your browser to Anthropic** using your own
  API key. Anthropic retains prompts and completions for 30 days for safety
  review, then auto-deletes them. API data is not used for model training.
- **Your Anthropic account is yours**, not Phylax's. You can audit usage and
  revoke the key directly in Anthropic's console at any time.
- **No telemetry, no analytics, no error reporting services.**

The in-app disclaimer (shown on first AI activation) and the "Datenschutz
beim KI-Chat" popover (chat header, settings section) carry the same
information in German at the point of use.

## Project status

Phylax is preparing its v1.0.0 public release. Phases 1 through 3 are
complete:

- **Phase 1 - Foundation**: crypto, storage, onboarding, auto-lock, PWA
- **Phase 2 - Profile**: domain model, repositories, profile versioning
- **Phase 2b - Import**: markdown parser, import pipeline, UI
- **Phase 2c - Views**: read-only views for observations, lab values,
  supplements, open points, timeline, profile overview
- **Phase 2d - Theming**: dark mode with system-preference detection
- **Phase 3 - AI-Guided Input**: Anthropic Claude integration, chat UI,
  guided session, commit preview, parser fallback
- **Infrastructure (I-series)**: Node 24, CI coverage policy, privacy
  disclosure precision
- **Phase S**: donation integration (settings link, onboarding hint,
  90-day reminder)

Current test counts: 1096 unit tests, 95 production E2E tests, 0 axe
violations. Bundle size: 177.99 / 180 KB gzipped. Mutation testing
thresholds per-module (crypto 95%, repositories 95%, parser 55%, import
75%).

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full task breakdown and
[CHANGELOG.md](CHANGELOG.md) for the release history.

## Quick start

### Try it live

Open https://astrapi69.github.io/phylax/ in Chrome, Edge, or any
Chromium-based browser. Click "Install Phylax" from the address bar (or
three-dot menu) to add it to your home screen / app drawer. Phylax runs
entirely in the browser and works offline after the first visit.

### Run from source

Requires Node.js 24 or later. CI and `.nvmrc` both pin Node 24. If
you use nvm, `nvm use` picks up the `.nvmrc` version.

```bash
git clone https://github.com/astrapi69/phylax.git
cd phylax
npm install
make dev          # http://localhost:6173
```

On first visit, the app walks you through creating a master password. After
that, the profile view is your home; import an existing markdown profile or
start by adding observations manually.

Build for production:

```bash
make build
make preview      # http://localhost:6174
```

### Install as a PWA

Once the production build is served (or once a deployed version is
available), the browser will offer "Install Phylax" in the URL bar or via
the three-dot menu. After install, Phylax runs offline and appears as a
standalone app on the home screen or app drawer.

### Run tests

```bash
make test                 # Unit tests (1096 tests)
make test-e2e             # E2E tests against dev server
make test-e2e-production  # E2E tests against production build (95 tests)
make test-bundle-size     # Production bundle vs size-limit budgets
make ci-local-full        # Everything CI runs
```

Run `make help` to see all available targets.

## AI features (optional)

AI features are opt-in and require your own Anthropic API key.

1. Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com).
2. In Phylax: Einstellungen -> KI-Assistent -> paste the key -> accept the
   disclaimer -> "KI aktivieren".
3. Navigate to `/chat` and start a conversation. Use "Profil teilen" to let
   the AI see your current profile context (ephemeral, not persisted).
4. Use "Gefuehrte Sitzung starten" for a guided walkthrough of three
   profile sections (observations, supplements, open points).

The assistant is a structuring partner, not a diagnostician. See the
in-app disclaimer for the exact boundaries.

## Development

### Test patterns

- **State-holding modules** (keyStore): use `vi.resetModules()` + dynamic
  `import()` in `beforeEach` to get a fresh module instance per test.
- **PBKDF2 + fake timers**: call `vi.useFakeTimers()` AFTER async setup
  that involves PBKDF2. Key derivation at 1.2M iterations takes ~420ms of
  real wall time and will hang under fake timers.
- **IndexedDB cleanup** in Playwright: `page.evaluate(() => indexedDB.deleteDatabase('phylax'))`
  before each E2E test.
- **Auth test setup**: `setupCompletedOnboarding(password)` in
  `src/db/test-helpers.ts` creates a meta row and leaves the key store
  locked, ready for unlock tests.
- **Per-module coverage thresholds** are enforced in CI, not locally (see
  `.claude/rules/quality-checks.md`).

### PWA development caveats

- In dev mode, the service worker may cache stale assets. Clear via
  `chrome://serviceworker-internals` (unregister the SW) or use an
  incognito window.
- Offline caching only works in production builds. Use
  `make test-e2e-production` to verify.
- `devOptions.type: 'module'` is enabled for modern dev SW support.

### Icon regeneration

Icons are generated from SVG sources via `@resvg/resvg-js`:

```bash
make icons        # Reads public/icons/source.svg, writes all PWA icon sizes
```

## Architecture

Phylax uses a three-layer architecture enforced by ESLint:

**UI layer** (React 18 + TypeScript + Tailwind + Vite): functional
components, hooks, feature folders. Never imports `crypto.subtle` or Dexie
directly.

**Domain layer** (pure TypeScript): types, validation, business logic. No
React, no Dexie. Defines interfaces; implementations are injected from the
storage layer.

**Storage layer** (Dexie + Web Crypto): IndexedDB schema, encrypted
repositories. Every record is stored as
`{ id, profileId, createdAt, updatedAt, payload }` where `payload` is a
single AES-256-GCM encrypted blob. Only structural metadata is plaintext;
content fields are filtered in-memory after decryption.

The app is a PWA via vite-plugin-pwa with Workbox precaching. All assets
are bundled; no external network calls at runtime except user-initiated
AI requests.

```
src/
  crypto/          Encryption and key derivation (only place using crypto.subtle)
  db/              Dexie schema and repositories (only place importing Dexie)
  domain/          Pure business logic, validation, types
  features/        React feature folders (onboarding, profile, ai-chat, ai-config, ...)
  router/          Route definitions and auth guards
  ui/              Shared UI components
  i18n/            Translations (DE, EN)
  lib/             Small utilities
  pwa/             Service worker registration
  test/            Shared test setup
```

### Further reading

- [docs/CONCEPT.md](docs/CONCEPT.md): living health profile vision, data
  model, AI role, security model (German)
- [docs/ROADMAP.md](docs/ROADMAP.md): task list with IDs, grouped by phase,
  progress checkboxes
- [docs/decisions/](docs/decisions/): architectural decision records (ADRs)
- [docs/audits/](docs/audits/): coverage audits and state reports
- [.claude/rules/](.claude/rules/): architecture rules, coding standards,
  quality checks

## Contributing

Phylax is developed by a single person. For v1.0.0, pull requests are
deferred in favor of stabilization, but the following are welcome:

- **Bug reports** via [GitHub Issues](https://github.com/astrapi69/phylax/issues)
- **Feature feedback**, especially from users of similar tools
- **Security reports** (responsible disclosure; a SECURITY.md will follow)
- **Translation review** for German UI strings

Pull requests will be accepted after v1.0.0 ships. See
[.claude/rules/](.claude/rules/) for the architectural and coding
standards that contributions will need to follow.

## Support the project

Phylax is developed by a single person as an open-source project. If you
find it useful, consider supporting its continued development.

See [DONATE.md](DONATE.md) for options (Liberapay, GitHub Sponsors, Ko-fi,
PayPal). Liberapay is the recommended path: FOSS-friendly, no platform
fees, no account required for the donor.

## License

[MIT](LICENSE)

## Acknowledgments

- The "Lebende Gesundheit" concept by Asterios Raptis, implemented here in
  code form
- [React](https://react.dev/), [Vite](https://vitejs.dev/),
  [Dexie.js](https://dexie.org/), [Tailwind CSS](https://tailwindcss.com/),
  [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/)
- [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm) for
  accessibility testing
- [@resvg/resvg-js](https://github.com/yisibl/resvg-js) for icon generation
- [Anthropic Claude](https://www.anthropic.com/claude) for the optional AI
  structuring partner
