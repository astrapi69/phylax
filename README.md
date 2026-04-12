# Phylax

Your local-first, zero-knowledge health diary.

<!-- Badges: replace with real URLs once GitHub Actions CI is wired up (F-17) -->
<!-- ![Build](https://img.shields.io/github/actions/workflow/status/astrapi69/phylax/ci.yml?branch=main) -->
<!-- ![Tests](https://img.shields.io/github/actions/workflow/status/astrapi69/phylax/ci.yml?branch=main&label=tests) -->

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is Phylax

Phylax (Greek: phylax, "guardian") is a personal, data-sovereign health record
built as a Progressive Web App. All data stays on your device, encrypted with a
master password you choose. There is no backend, no cloud, no telemetry, and no
data collection.

The app serves as a structured health diary, medication tracker, and document
archive for doctor visits. It supports five entry types: symptoms, medications,
vitals (blood pressure, pulse, temperature, weight, blood glucose, SpO2),
appointments, and free-text notes. Documents such as PDFs and images can be
uploaded, encrypted, and linked to entries.

Think of it as a password manager, but for your health records.

## Origin

Phylax grew out of a personal essay series on Medium titled
[Lebende Gesundheit](https://asterios-raptis.medium.com/lebende-gesundheit-die-serie-0193f66df9a3)
("Living Health", in German). The series started as a concept piece on health
as a process the individual leads with observation and long-term context, rather
than a state managed by professionals in ten-minute appointments. It turned
personal when the author's 85-year-old mother faced dementia, hypertension,
iron deficiency, and a stack of lab results no single doctor had the full
picture of.

Phylax is the tool the series kept pointing toward: a place where a person
(or a caregiver) can collect, structure, and bring along the context that
ten-minute appointments cannot reconstruct from scratch.

## Not a medical device

Phylax is a personal data management tool. It does not provide medical advice,
diagnosis, or treatment recommendations.

If you are experiencing a medical emergency, contact your doctor or call
emergency services immediately.

Phylax helps you organize and store your own health records. Nothing more.

## Threat model

**Phylax protects against:**

- A stolen or lost device while the app is locked
- Curious bystanders with physical access to your browser
- Cloud-based data breaches (there is no cloud)
- Supply-chain telemetry leaks (there is no telemetry)

**Phylax does NOT protect against:**

- Keyloggers or malware on your device
- A compromised operating system or browser
- A weak master password
- Physical coercion
- Browser-level exploits

For the full security model, see [docs/CONCEPT.md](docs/CONCEPT.md).

## Current status

**Early development. Not yet functional for end users.**

Completed foundation tasks:

- F-01: Vite + React 18 + TypeScript strict + Tailwind + ESLint + Prettier
- F-02: Folder structure per architecture rules
- F-03: ESLint rules enforcing crypto and Dexie import boundaries
- F-04: Pre-commit hook with Husky and lint-staged
- F-05: Vitest setup with fake-indexeddb and Testing Library

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full task list and current phase.

## Tech stack

React 18, TypeScript (strict mode), Vite, Tailwind CSS, Dexie.js (IndexedDB),
Web Crypto API (native, no third-party crypto library), PWA via vite-plugin-pwa,
Vitest, Playwright. See [package.json](package.json) for exact versions.

## Getting started (developers)

```bash
git clone https://github.com/astrapi69/phylax.git
cd phylax
npm install
npm run dev        # Start dev server
```

Other commands:

```bash
npm test           # Run unit tests (Vitest)
npm run test:coverage  # Run tests with coverage report
npm run lint       # ESLint
npm run format:check   # Prettier check
npm run typecheck  # TypeScript type check
npm run build      # Production build
```

There are no end-user install instructions yet. The app is not deployable.

## Project structure

```
src/
  crypto/          Encryption and key derivation (only place that uses crypto.subtle)
  db/              Dexie schema and repositories (only place that imports Dexie)
  domain/          Pure business logic, validation, types (no React, no Dexie)
  features/        React feature folders (onboarding, entries, documents, export, backup, settings)
  ui/              Shared UI components (buttons, inputs, modals)
  i18n/            Translations (DE, EN)
  lib/             Small utilities with no domain knowledge
  test/            Shared test setup and helpers
docs/
  CONCEPT.md       Project vision and security model (German)
  ROADMAP.md       Task list and phase plan
.claude/
  rules/           Architecture, coding standards, quality checks, workflow rules
```

For the full architecture, see [.claude/rules/architecture.md](.claude/rules/architecture.md).

## Documentation

| Document                           | Description                                                         |
| ---------------------------------- | ------------------------------------------------------------------- |
| [docs/CONCEPT.md](docs/CONCEPT.md) | Project vision, data model, security model, and phase plan (German) |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Task list with IDs, grouped by phase, checkboxes for progress       |
| [CLAUDE.md](CLAUDE.md)             | Context document for Claude Code (development rules, constraints)   |
| [.claude/rules/](.claude/rules/)   | Architecture, coding standards, quality checks, release workflow    |

## Contributing

Phylax is a solo project at this stage. Contributions are not accepted yet.
Bug reports are welcome once there is a running application to test.

## License

[MIT](LICENSE)
