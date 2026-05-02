# Phylax Codebase Audit Prompt

Analyze the Phylax codebase and perform a systematic audit based on the following criteria. Phylax is a local-first, zero-knowledge React 18 + TypeScript PWA with no backend; non-negotiable principles in `CLAUDE.md` and `.claude/rules/` are authoritative.

## 1. Test Validity

- Cross-reference unit (Vitest), repository (Vitest + fake-indexeddb), and E2E tests (Playwright dev `tests/e2e/` and production `tests/e2e-production/`) against current implementation.
- Identify outdated, redundant, unreachable, or structure-coupled tests (assertions on CSS classes, internal state, etc.).
- Assess coverage of critical paths against per-module thresholds in `.claude/rules/quality-checks.md` (`crypto/` 100%, `db/` 95%, `domain/` 90%, `features/` 85%, `ui/` 85%, `lib/` 90%).
- Verify mutation thresholds in `.claude/rules/quality-checks.md` table are still met by the latest nightly Stryker run; flag drift.
- Verify production E2E covers SW/offline, base-path (`/phylax/`), and axe-a11y; flag any feature without a manual-smoke artifact in `docs/manual-smoke/` when `.claude/rules/test-strategy.md` requires one.

## 2. Code Quality and Technical Debt

- Detect deprecated patterns, orphaned imports, unused exports/variables, dead functions (`ts-prune` if needed).
- Enforce the 3-layer model from `.claude/rules/architecture.md`: no `crypto.subtle` outside `src/crypto/`, no `dexie` outside `src/db/`, no React/Dexie imports in `src/domain/`. Flag every leak as Blocker.
- Verify TS strictness: no `any` without an inline justification, no `// @ts-ignore`/`as unknown as` without comment, `noUncheckedIndexedAccess` respected.
- Forbidden in production code (per `.claude/rules/coding-standards.md`): `console.log`, `alert/confirm/prompt`, em-dashes, inline secrets, third-party CDN URLs at runtime, medical-advice/diagnosis heuristics, telemetry/error-reporting calls.
- Verify Storage-Key convention from `CLAUDE.md` (`phylax-`/`phylax.` prefix) for any new `localStorage`/`sessionStorage` key; flag if the reset hook (`src/features/reset/useResetAllData.ts`) would miss a key.
- Check error handling at system boundaries only (user input, AI provider calls); flag defensive code inside trusted internals.
- Naming, file organization, and imports per `.claude/rules/code-hygiene.md`.

## 3. Infrastructure and Dependencies

- Validate `package.json` and `package-lock.json` against the locked dependency list in `.claude/rules/coding-standards.md`. Any addition without an ADR in `docs/decisions/` is a Blocker.
- Verify `Makefile` is the single entry point for build/test/lint/format/dev (per `.claude/rules/ai-workflow.md`); flag npm scripts called directly outside the documented exceptions (`Makefile`, `package.json`, Playwright `webServer.command`, CI workflow steps in containers without `make`).
- Audit GitHub Actions (`.github/workflows/*.yml`): job structure (lint+typecheck, unit+coverage, e2e-dev, build+size-limit, e2e-production, mutation-nightly), gate completeness for cross-cutting changes (`make test`, `make test-e2e`, `make test-e2e-production`, `make typecheck`, `make lint`, `make build`).
- Bundle-size: `.size-limit.json` budgets vs `.claude/rules/quality-checks.md` table (main JS 350 KB, total JS+CSS 380 KB, project ceiling 400 KB gz, ADR-0015). Flag drift.
- Verify no runtime third-party network calls outside user-initiated AI requests with the user's own API key (Phase 3+). No Sentry, no analytics, no Google Fonts, no CDN.
- PWA: service-worker config (`vite-plugin-pwa`), precache list, no external URLs cached, base path `/phylax/` for GH Pages (D-01).
- Git workflow: Conventional Commits with task-ID brackets per `.claude/rules/task-series.md`, branch structure, `.gitignore` consistency.
- No Poetry, no Docker (Phylax has no backend); flag any introduction.

## 4. Documentation and Structure

- Audit `README.md`, install/onboarding docs, ADRs (`docs/decisions/`), `docs/CONCEPT.md`, `docs/ROADMAP.md`, `docs/backup-format.md`, `docs/i18n-glossary.md`, `docs/i18n-contributing.md`, `docs/ci-gates.md` for accuracy vs current code.
- Verify language convention from `CLAUDE.md`: EN for code/ADRs/CI/contributor docs/commits, DE for `CLAUDE.md`/`CONCEPT.md`/`backup-format.md`/`ROADMAP.md`, locale strings in target language with required Unicode umlauts (no auto-transliteration).
- Em-dash ban applies to all docs and UI strings.
- Project structure vs `.claude/rules/architecture.md` folder layout; flag misplaced files (e.g., crypto helper outside `src/crypto/`, Dexie code outside `src/db/`).
- Audit-file convention: confirm `docs/audits/current-coverage.md` is current and prior versions are archived under `docs/audits/history/YYYY-MM-DD-coverage.md`. Investigation artifacts in `docs/audits/`, execution artifacts in `docs/manual-smoke/` - flag collapsed directories.
- ROADMAP task-series prefixes (F/O/IM/V/T/I/AI/D/X/B/P/M/DP/E/R/I18N) match `.claude/rules/task-series.md`; flag undeclared prefixes.

## Output Format

- Markdown, strictly structured by the 4 sections above. Skip a section entirely if there are no findings (do not pad).
- Each finding row: `[File/Path:Line]` | `[Type]` | `[Priority]` | `[Reason]` | `[Recommended Action]`
- Types: Blocker, Security, Outdated, Improvement, Info
- Priority: P0 (security/data-integrity, ship-blocking) to P3 (optional)
- Any crypto-, storage-, or threat-model-relevant finding is at minimum Security/P1.
- No speculation. `[TBD]` for unclear context. Verifiable facts only (cite file:line, commit, ADR, or rule path).
- If the audit modifies state, follow `.claude/rules/ai-workflow.md` audit handling: archive existing `docs/audits/current-coverage.md` to `docs/audits/history/YYYY-MM-DD-coverage.md` before writing the new one.
- Focus on automation readiness and direct implementability: each P0/P1 finding must be actionable in a single PR.
