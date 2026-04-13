# Phylax

Your local-first, zero-knowledge living health profile.

[![CI](https://github.com/astrapi69/phylax/actions/workflows/ci.yml/badge.svg)](https://github.com/astrapi69/phylax/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is Phylax

Phylax (Greek: phylax, "guardian") is a personal, data-sovereign health
platform built as a Progressive Web App. All data stays on your device,
encrypted with a master password you choose. There is no backend, no cloud,
no telemetry, and no data collection.

The core artifact is a **living medical profile**: a versioned, structured
document where you record observations about your health, grouped by theme
(e.g., "Shoulder", "Nutrition", "Blood pressure"). Each observation has three
facets: what happened (fact), what recurs (pattern), and what you decided to
do about it (self-regulation). The profile also tracks lab values, supplements,
and open questions for your next doctor visit.

Phylax supports AI-guided profile creation: you provide fragments (lab photos,
medication names, verbal observations), and an AI structures them into your
profile using your own API key (OpenAI or Anthropic). The AI operates under a
strict contract: it structures, it does not diagnose. You can also enter data
manually or paste markdown from an external AI session.

The name comes from the Greek phylax (guardian). Phylax is not a doctor, not a
database, but a guardian of your health narrative.

**Who is Phylax for?**

- Privacy-conscious individuals tracking their own health profile
- Caregivers tracking dependents (elderly parent with dementia, child)
- Anyone preparing for doctor visits with structured, fact-based notes

## Origin

Phylax grew out of a personal essay series on Medium titled
[Lebende Gesundheit](https://asterios-raptis.medium.com/lebende-gesundheit-die-serie-0193f66df9a3)
("Living Health") by Asterios Raptis. The series has four parts:

1. **Concept**: health as a process the individual leads, not a state managed by professionals
2. **Self-application**: observe your body, find patterns, self-regulate
3. **Caregiver profiles**: leading the health profile for someone who cannot do it themselves
4. **AI as structuring partner**: AI organizes your fragments into a profile, never diagnoses

The series turned personal when the author's 85-year-old mother faced
dementia, hypertension, iron deficiency, and a stack of lab results no single
doctor had the full picture of. Phylax is the tool the series kept pointing
toward: a place where a person (or a caregiver) can collect, structure, and
bring along the context that ten-minute appointments cannot reconstruct from
scratch.

## Not a medical device

Phylax is a personal data management tool. It does not provide medical advice,
diagnosis, or treatment recommendations.

AI in Phylax structures, it does not diagnose. The AI organizes what you bring
in. It does not interpret your health data, recommend treatments, or replace
professional medical judgment.

If you are experiencing a medical emergency, contact your doctor or call
emergency services immediately.

Phylax helps you organize and store your own health records. Nothing more.

## Security

Phylax encrypts all health data before writing it to the browser's IndexedDB:

- **AES-256-GCM** encryption per record, with a unique 12-byte IV per write
- **PBKDF2-SHA256** key derivation with 1.2 million iterations from your master password
- **In-memory key only**: the derived key is never written to disk. It lives in memory while the app is unlocked and is cleared on lock or page close.
- **Auto-lock** after 5 minutes of inactivity (configurable)
- **No network calls** except user-initiated AI requests with the user's own API key

**Phylax protects against:**

- An attacker reading your IndexedDB without the master password (encrypted at rest)
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

## Project status

Phylax is in pre-release. Phase 1 (foundation) is complete: onboarding,
unlock, auto-lock, encrypted storage, and PWA install all work. Phase 2
(profile features) is next. There are no published builds yet; build from
source if you want to try it.

**Phase 1 (Foundation):** complete (F-01 through F-18)

- Crypto layer: AES-256-GCM, PBKDF2, in-memory key store
- Storage layer: 8 encrypted IndexedDB tables via Dexie
- Auth flows: onboarding, unlock, auto-lock
- PWA: installable, works offline
- App shell: routing, navigation, protected routes
- CI: lint, typecheck, unit tests, E2E, production E2E, bundle budget
- 170 unit tests, 21 E2E tests, 93% statement coverage

**Phase 2 (Profile):** not started

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full task list.

## Quick start

Requires Node.js 18 or later.

```bash
git clone https://github.com/astrapi69/phylax.git
cd phylax
npm install
make dev          # http://localhost:6173
```

Build for production:

```bash
make build
make preview      # http://localhost:6174
```

Run tests:

```bash
make test                # Unit tests (170 tests)
make test-e2e            # E2E tests against dev server
make test-e2e-production # E2E tests against production build
make ci-local-full       # Everything CI runs
```

Run `make help` to see all available targets.

## Development

### Test patterns

- **State-holding modules** (keyStore): use `vi.resetModules()` + dynamic `import()` in `beforeEach` to get a fresh module instance per test. Do not use static imports.
- **PBKDF2 + fake timers**: call `vi.useFakeTimers()` AFTER async setup that involves PBKDF2. Key derivation at 1.2M iterations takes ~420ms of real wall time and will hang under fake timers.
- **IndexedDB cleanup** in Playwright: `page.evaluate(() => indexedDB.deleteDatabase('phylax'))` before each E2E test.
- **Auth test setup**: `setupCompletedOnboarding(password)` in `src/db/test-helpers.ts` creates a meta row and leaves the key store locked, ready for unlock tests.
- **Per-module coverage thresholds** are enforced in `vite.config.ts`. Crypto requires 100%. See the thresholds section for exact values.

### PWA development caveats

- In dev mode, the service worker may cache stale assets. Clear via `chrome://serviceworker-internals` (unregister the SW) or use an incognito window.
- Offline caching only works in production builds. Use `make test-e2e-production` to verify.
- `devOptions.type: 'module'` is enabled for modern dev SW support.

### Icon regeneration

Icons are generated from SVG sources via `@resvg/resvg-js`:

```bash
make icons        # Reads public/icons/source.svg, writes PNGs
```

## Architecture

Phylax uses a three-layer architecture enforced by ESLint:

**UI layer** (React 18 + TypeScript + Tailwind + Vite): functional components,
hooks, feature folders. Never imports `crypto.subtle` or Dexie directly.

**Domain layer** (pure TypeScript): types, validation, business logic. No React,
no Dexie. Defines interfaces; implementations are injected from the storage layer.

**Storage layer** (Dexie + Web Crypto): IndexedDB schema, encrypted repositories.
Every record is stored as `{ id, profileId, createdAt, updatedAt, payload }` where
`payload` is a single AES-256-GCM encrypted blob. Only structural metadata is
plaintext; content fields are filtered in-memory after decryption.

The app is a PWA via vite-plugin-pwa with Workbox precaching. All assets are
bundled; no external network calls at runtime except user-initiated AI requests.

```
src/
  crypto/          Encryption and key derivation (only place that uses crypto.subtle)
  db/              Dexie schema and repositories (only place that imports Dexie)
  domain/          Pure business logic, validation, types
  features/        React feature folders (onboarding, unlock, auto-lock, profile, ...)
  router/          Route definitions and auth guards
  ui/              Shared UI components
  i18n/            Translations (DE, EN)
  lib/             Small utilities
  pwa/             Service worker registration
  test/            Shared test setup
```

### Further reading

- [docs/CONCEPT.md](docs/CONCEPT.md): living health profile vision, data model, AI role, security model (German)
- [docs/ROADMAP.md](docs/ROADMAP.md): task list with IDs, grouped by phase, progress checkboxes
- [docs/decisions/](docs/decisions/): architectural decision records (ADRs)
- [docs/audits/](docs/audits/): coverage audits and state reports
- [.claude/rules/](.claude/rules/): architecture rules, coding standards, quality checks

## Contributing

Phylax is a solo project at this stage. Contributions are not accepted yet.
Bug reports and feedback are welcome via
[GitHub Issues](https://github.com/astrapi69/phylax/issues) once there is a
running application to test.

## License

[MIT](LICENSE)
