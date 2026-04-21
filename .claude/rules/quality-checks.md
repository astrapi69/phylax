# Quality Checks and Test Strategy

## Quick check after every change

### 1. Run tests

```bash
make test                   # Vitest unit tests, must be green
make test-e2e               # Playwright end-to-end, must be green before commit
make typecheck              # tsc --noEmit
make lint                   # ESLint
make format-check           # Prettier
make test-bundle-size       # Production bundle vs size-limit budgets
```

Use Make targets, not npm scripts directly (see ai-workflow.md).

A single failing test blocks the commit. No exceptions.

Coverage thresholds are enforced by GitHub Actions CI (I-03), not locally.
Local coverage instrumentation roughly doubles CPU/memory load on 800+
tests with crypto operations, which is expensive on developer machines.
For a manual local coverage check before pushing: `make test-coverage`.
`make ci-local-full` deliberately omits it; CI is the source of truth.

### 2. Manual smoke test

After any change touching crypto, storage, or the lock flow, manually verify:

1. Fresh install: open app in incognito, set a master password, create one entry of each type, lock, unlock, see entries.
2. Wrong password: lock, enter wrong password, see error, no data leak in console.
3. Auto-lock: wait for timeout, confirm app locks and key is cleared.
4. Backup round-trip: export backup, wipe IndexedDB, import backup, see all entries.

## Test layers

### Unit tests (Vitest)

- `src/crypto/`: 100% line coverage. Round-trip tests, negative tests (wrong key, tampered ciphertext, truncated IV).
- `src/db/repositories/`: tested against fake-indexeddb. Verify ciphertext is stored, plaintext is returned.
- `src/domain/`: pure functions, easy to test. Validation, transformations, business rules.
- React components: test behavior with React Testing Library, not implementation details.

### End-to-end tests (Playwright)

Critical flows that must always work:

- Onboarding: set master password, see empty dashboard.
- Create one entry of each type and confirm it appears in the list.
- Lock and unlock with correct password.
- Lock and reject wrong password.
- Auto-lock after inactivity.
- Backup export and restore.
- PDF export of a date range.

Run E2E in CI on every PR.

## Coverage thresholds

Project overall: 85 to 95 percent lines. The test suite must genuinely protect the code, not just tick a box.

Per-module targets, differentiated by risk:

- `src/crypto/`: 100% lines, 100% branches. Hard requirement. Security-critical, no exceptions.
- `src/db/` (repositories, schema): 95% lines minimum.
- `src/domain/`: 90% lines minimum.
- `src/features/` (React components, hooks, flows): 85% lines minimum. Tested with React Testing Library, behavior not implementation.
- `src/ui/` (shared dumb components): 85% lines minimum.
- `src/lib/` (utilities): 90% lines minimum.

No module falls below 80% without an explicit ADR-documented exception in `docs/decisions/`.

Frontend modules (`src/features/`, `src/ui/`) are NOT exempt from gap closure and are prioritized on equal footing with backend modules. User-facing bugs erode trust as fast as backend bugs corrupt data.

Coverage is checked in CI. Drops below threshold block the merge.

## Security checks

### On every commit

- ESLint rule `no-restricted-imports` blocks `crypto.subtle` outside `src/crypto/`.
- ESLint rule blocks `dexie` imports outside `src/db/`.
- ESLint rule blocks `console.log` in production code (allowed in tests).

### On every release

- Run `npm audit` and resolve all high/critical findings.
- Verify the production bundle has no third-party network calls (use Chrome DevTools network tab on a fresh install).
- Check the service worker cache list does not include any external URLs.

## Audit file convention

Coverage audits are written to `docs/audits/current-coverage.md`. This is the single canonical file for the latest audit.

When a new audit runs, the previous version is archived:

1. Read the "Audit date" header from the existing `current-coverage.md`.
2. Move it to `docs/audits/history/YYYY-MM-DD-coverage.md` using that date.
3. Write the new audit to `docs/audits/current-coverage.md`.

Never overwrite the current audit without archiving the previous version first.

## Mutation testing thresholds

Per-module thresholds enforced by nightly CI (ADR-0011). Each module has its own Stryker config.

| Module       | Config             | Threshold | Baseline | Date       |
| ------------ | ------------------ | --------- | -------- | ---------- |
| Crypto       | stryker.crypto.mjs | 95%       | 100.00%  | 2026-04-16 |
| Repositories | stryker.repos.mjs  | 95%       | 100.00%  | 2026-04-16 |
| Parser       | stryker.parser.mjs | 55%       | 57.81%   | 2026-04-16 |
| Import       | stryker.import.mjs | 75%       | 81.16%   | 2026-04-16 |

### Threshold policy

- Initial threshold: measured baseline minus 5%, rounded down.
- Ratchet up when test-hardening work improves the score.
- Parser threshold is intentionally low (fixture-dependent code with many equivalent regex mutants).
- UI modules are not mutation-tested (JSX mutations produce mostly equivalent output).

### Survivor categories

- **A (fix)**: real test gap, fixable with a quick test addition. Fix immediately.
- **B (exclude)**: equivalent mutant or test-environment limitation. Add inline `// Stryker disable` with one-line justification.
- **C (defer)**: real gap but requires substantial test refactoring. Document in commit message, defer to dedicated task.

### How to update thresholds

When a test-hardening task raises a module's score:

1. Re-run the module-specific mutation target (e.g., `make test-mutation-parser`).
2. Update the threshold in the module's stryker config file.
3. Update the table above with new baseline and date.
4. Note the change in the commit message.

## Performance budget

- Initial JS bundle: under 400 KB gzipped (project-wide ceiling, ADR-0015). Per-chunk budgets enforced by size-limit via `make test-bundle-size`: main JS 350 KB (ADR-0015), Workbox chunk 8 KB, CSS bundle 15 KB, total JS+CSS 380 KB (ADR-0015), setup lazy chunks 250 KB (ADR-0014). See `.size-limit.json` for the live values. The per-chunk budgets are the operative CI gate; 400 KB is the absolute maximum before code-splitting is required. Any new runtime dependency >10 KB gzipped needs its own ADR entry.
- Time to interactive on a mid-range phone (Moto G class): under 3 seconds on a cold load.
- Encrypt/decrypt of a single entry: under 50ms.
- App must remain usable with 5,000 entries in the database.

## Browser support

- Latest Chrome, Firefox, Safari, Edge (last two versions).
- iOS Safari 16+, Chrome on Android 12+.
- No IE, no legacy Edge, no polyfills for dead browsers.
