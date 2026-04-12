# Quality Checks and Test Strategy

## Quick check after every change

### 1. Run tests

```bash
npm test                    # Vitest unit tests, must be green
npm run test:e2e            # Playwright end-to-end, must be green before commit
npm run typecheck           # tsc --noEmit
npm run lint                # ESLint
npm run format:check        # Prettier
```

A single failing test blocks the commit. No exceptions.

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

## Performance budget

- Initial JS bundle: under 250KB gzipped.
- Time to interactive on a mid-range phone (Moto G class): under 3 seconds on a cold load.
- Encrypt/decrypt of a single entry: under 50ms.
- App must remain usable with 5,000 entries in the database.

## Browser support

- Latest Chrome, Firefox, Safari, Edge (last two versions).
- iOS Safari 16+, Chrome on Android 12+.
- No IE, no legacy Edge, no polyfills for dead browsers.
