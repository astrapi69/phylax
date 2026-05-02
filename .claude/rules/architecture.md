# Architecture Rules

## Layered model (3 layers, ALWAYS enforced)

```
1. UI            React 19 + TypeScript + Tailwind + Vite (ADR-0021)
2. Domain        Repositories, services, validation (pure TS, no React, no Dexie imports)
3. Storage       Dexie (IndexedDB) + Web Crypto wrapper
```

The Domain layer NEVER imports from React or Dexie directly. It defines interfaces; implementations live in the Storage layer and are injected.

## Single repository

Phylax is a single repo, single package. No backend. No microservices. No plugin system. If a feature feels like it should be a plugin, it is most likely premature abstraction. Build it inline, refactor later if a second consumer appears.

## Frontend (React + TypeScript)

### Folder structure

```
src/
  main.tsx              # entry point
  App.tsx               # router shell
  crypto/               # ONLY place that touches crypto.subtle
    keyDerivation.ts
    aesGcm.ts
    index.ts
  db/                   # ONLY place that touches Dexie
    schema.ts
    repositories/
      profileRepository.ts
      observationRepository.ts
      labValueRepository.ts
      supplementRepository.ts
      openPointRepository.ts
      profileVersionRepository.ts
      documentRepository.ts
  domain/               # pure business logic, no React, no Dexie
    profile/
      types.ts
      validation.ts
    observations/
      types.ts
      validation.ts
    documents/
    backup/
  features/             # React features, one folder per user-facing area
    onboarding/
    profile/
    ai-input/
    documents/
    export/
    backup/
    settings/
  ui/                   # shared dumb components (Button, Input, Modal)
  i18n/
    de.json
    en.json
    index.ts
  lib/                  # tiny utilities, no domain knowledge
```

### Rules

- A React component NEVER calls `crypto.subtle` and NEVER calls Dexie. It calls a repository or a service.
- A repository takes plaintext objects in and returns plaintext objects out. Encryption happens inside the repository before `put` and after `get`.
- The crypto module is the ONLY place that imports from `crypto.subtle`. Enforced by an ESLint rule (`no-restricted-imports`).
- New features go into `features/<name>/`. They own their components, hooks, and feature-local state.
- Global state (auth/lock state, theme, locale) lives in React Context, not Redux.

## Storage layer

- IndexedDB via Dexie. One database `phylax`, schema versioned via Dexie migrations.
- Tables: `profiles`, `observations`, `lab_values`, `supplements`, `open_points`, `profile_versions`, `documents`, `meta` (salt, settings, schema version, encrypted API key).
- Every record stored as `{ id, profileId, createdAt, updatedAt, ciphertext, iv }`. Plaintext fields are NEVER persisted. All entities carry a `profileId` field from day one (MVP uses a single profile, multi-profile is a future phase).
- Search/filter happens in-memory after decryption. No plaintext indexes. Acceptable because the dataset is small (single user, personal profile).
- The canonical output is a markdown document rendered from the encrypted profile data.

## Crypto layer

- AES-256-GCM, 12-byte IV per record, 16-byte auth tag.
- PBKDF2-SHA256 key derivation, 1,200,000 iterations (per ADR-0001), 32-byte salt.
- Master key lives only in a module-level variable inside `crypto/`, never written to storage.
- Auto-lock clears the in-memory key after configurable inactivity (default 5 minutes).

## Threat model (what Phylax protects against, what it does not)

Protects against: stolen device while app is locked, curious bystanders, cloud breaches (no cloud), supply-chain telemetry leakage (no telemetry).

Does NOT protect against: keyloggers on the device, compromised OS, weak master password, physical coercion, browser exploits in the user's browser.

This is documented in the README and the onboarding flow, in plain language.

## Non-goals (do not build)

- No backend, ever.
- No multi-device sync in the MVP.
- No user accounts.
- No cloud storage.
- No telemetry, no analytics, no error reporting services.
- No medical advice features. Phylax is a documentation tool, not a medical device. AI structures, AI does not diagnose.
- No own backend service for AI. API calls go directly from the browser to the user's chosen provider (OpenAI / Anthropic) using the user's own API key.
- Chat messages from AI sessions are ephemeral and NEVER persisted. Only the user-confirmed profile fragment is saved.
