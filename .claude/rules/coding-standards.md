# Coding Standards

## General

- Developer: Asterios Raptis (solo, AI-assisted via Claude Code).
- Goal: pragmatic, maintainable, shippable. No over-engineering.
- When unclear: ask, do not guess.
- All code, comments, and commit messages in English. Documentation under `docs/` is in German. UI strings go through i18next.

## TypeScript

- TypeScript 5+, strict mode ON in `tsconfig.json` (`strict: true`, `noUncheckedIndexedAccess: true`).
- No `any` without an inline comment explaining why.
- Interfaces for data shapes, type aliases for unions and primitives.
- Functional React components only. No class components.
- Props are always declared as an interface, never inline.
- Complex logic lives in domain modules or custom hooks, not in components.
- Imports ordered: node builtins, third-party, absolute (`@/`), relative. Enforced by ESLint.

## React

- Hooks only. No HOCs unless absolutely necessary.
- One component per file. File name matches component name (PascalCase).
- Co-locate component, styles (Tailwind classes), and tests in the feature folder.
- Use React Context for cross-cutting state (lock state, theme, locale). Local state stays local.
- No `useEffect` for derived state. Compute it in the render body.

## Tailwind and styling

- Tailwind utility classes only. No CSS modules, no styled-components.
- One global stylesheet `src/index.css` for Tailwind directives and CSS resets.
- Mobile-first: every component must work at 360px width.
- Dark mode via `dark:` variant, controlled by class on `<html>`.

## Crypto code

- Only the `src/crypto/` module imports from `crypto.subtle`.
- Every public function in `crypto/` has a JSDoc block explaining inputs, outputs, and security assumptions.
- Constants (PBKDF2 iterations, IV length, key length) live in `crypto/constants.ts` and are never inlined.
- Round-trip tests are mandatory for every encrypt/decrypt pair.

## Dexie code

- Only modules under `src/db/` import Dexie.
- Schema changes go through Dexie's `version().upgrade()` mechanism. Migrations are tested.
- Repositories return domain types, never raw Dexie tables.

## Forbidden in production code

- `console.log` for user-facing information. Use the toast system.
- `alert()`, `confirm()`, `prompt()`. Use modal components.
- `any`, `as unknown as`, `// @ts-ignore` without an explanatory comment.
- Em-dashes in comments, strings, or documentation. Use hyphens or commas.
- Inline secrets, API keys, or default passwords.
- Direct `crypto.subtle` calls outside `src/crypto/`.
- Direct Dexie imports outside `src/db/`.
- Third-party CDN URLs in HTML or runtime code. Everything bundled.

## Allowed dependencies (locked list)

Core: `react`, `react-dom`, `react-router-dom`, `dexie`, `jspdf`, `i18next`, `react-i18next`, `tailwindcss`.

Dev: `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa`, `typescript`, `vitest`, `@playwright/test`, `eslint`, `prettier`.

Adding a new dependency requires explicit approval and an entry in `docs/decisions/`.
