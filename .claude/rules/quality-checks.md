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

- `src/crypto/`: 100% lines, 100% branches. Hard requirement.
- `src/db/`: 90% lines minimum.
- `src/domain/`: 80% lines minimum.
- `src/features/`: no hard threshold, but every feature needs at least one happy-path test.

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

## Performance budget

- Initial JS bundle: under 250KB gzipped.
- Time to interactive on a mid-range phone (Moto G class): under 3 seconds on a cold load.
- Encrypt/decrypt of a single entry: under 50ms.
- App must remain usable with 5,000 entries in the database.

## Browser support

- Latest Chrome, Firefox, Safari, Edge (last two versions).
- iOS Safari 16+, Chrome on Android 12+.
- No IE, no legacy Edge, no polyfills for dead browsers.
