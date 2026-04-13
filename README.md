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
profile. The AI operates under a strict contract: it structures, it does not
diagnose. You can also enter data manually or paste markdown from an external
AI session.

Think of it as a password manager, but for your health context.

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

AI in Phylax structures, it does not diagnose. The AI organizes what you bring
in. It does not interpret your health data, recommend treatments, or replace
professional medical judgment.

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
- F-06: Playwright setup with smoke test
- F-07: AES-256-GCM encrypt/decrypt with round-trip and negative tests

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full task list and current phase.

## Tech stack

React 18, TypeScript (strict mode), Vite, Tailwind CSS, Dexie.js (IndexedDB),
Web Crypto API (native, no third-party crypto library), PWA via vite-plugin-pwa,
Vitest, Playwright. AI integration via user-provided API key (OpenAI or
Anthropic, no own backend). See [package.json](package.json) for exact versions.

## Getting started (developers)

```bash
git clone https://github.com/astrapi69/phylax.git
cd phylax
make install             # Clean install of dependencies
make dev                 # Start dev server on port 6173
```

Other commands:

```bash
make test                # Run unit tests
make test-coverage       # Run tests with coverage report
make lint                # ESLint
make format-check        # Prettier check
make typecheck           # TypeScript type check
make build               # Production build
make check               # Run lint, typecheck, test, and build in one command
```

Run `make help` to see all available targets.

There are no end-user install instructions yet. The app is not deployable.

## Project structure

```
src/
  crypto/          Encryption and key derivation (only place that uses crypto.subtle)
  db/              Dexie schema and repositories (only place that imports Dexie)
  domain/          Pure business logic, validation, types (no React, no Dexie)
  features/        React feature folders (onboarding, profile, ai-input, documents, export, backup, settings)
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

| Document                           | Description                                                                |
| ---------------------------------- | -------------------------------------------------------------------------- |
| [docs/CONCEPT.md](docs/CONCEPT.md) | Living health profile vision, data model, AI role, security model (German) |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Task list with IDs, grouped by phase, checkboxes for progress              |
| [CLAUDE.md](CLAUDE.md)             | Context document for Claude Code (development rules, constraints)          |
| [.claude/rules/](.claude/rules/)   | Architecture, coding standards, quality checks, release workflow           |

## Contributing

Phylax is a solo project at this stage. Contributions are not accepted yet.
Bug reports are welcome once there is a running application to test.

## License

[MIT](LICENSE)
