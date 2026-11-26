# Known Pitfalls and Patterns

This file collects lessons that come from real development. It starts small and grows as the project evolves. When a problem appears twice, it goes here.

## Web Crypto API

### Master key lifetime

- The derived AES key from PBKDF2 is a `CryptoKey` object, not a raw byte array. It cannot be serialized or logged accidentally, which is good.
- Store the key in a module-level variable inside `src/crypto/keyStore.ts`. NEVER pass it across module boundaries. Repositories receive an "unlocked" repository instance instead of the key.
- On auto-lock, set the variable to `null`. There is no way to wipe the underlying key material from memory deterministically in JavaScript. Accept this limitation.

### IV reuse is catastrophic

- AES-GCM with a reused IV under the same key destroys confidentiality AND authenticity. Always generate a fresh 12-byte IV per encryption call via `crypto.getRandomValues`.
- Test that two encryptions of the same plaintext produce different ciphertexts. This catches accidental IV reuse.

### PBKDF2 iterations and UX

- 1,200,000 iterations (ADR-0001) on a mid-range phone takes roughly 1600ms. Acceptable for unlock but feels slow; the spinner is what makes it bearable.
- Show a spinner during unlock. Do not let the UI freeze.
- Do NOT lower the iteration count for performance. Lower the perceived latency with UX.

## Dexie and IndexedDB

### Schema migrations

- Dexie migrations run on the user's device, on data the developer has never seen. There is no way to "test against production data".
- Every migration has a forward test (old schema -> new schema) AND a fresh-install test (new schema from scratch).
- Migrations that add a new table are safe. Migrations that change an existing table's structure require re-encryption of all rows. Plan for it.

### Bulk operations

- `bulkPut` is dramatically faster than a loop of `put`. Use it for backup restore.
- Wrap multi-table operations in a Dexie transaction, otherwise a partial failure leaves the DB in a half-state.

### Quota

- Browsers may evict IndexedDB data under storage pressure, especially on iOS Safari.
- Use the Storage API (`navigator.storage.persist()`) to request persistent storage on first unlock. Inform the user if the request is denied.

## React and PWA

### Service worker updates

- A new service worker only takes effect after all tabs of the app are closed. Users will see stale UI until then.
- Use `vite-plugin-pwa`'s `registerType: 'prompt'` mode together with `skipWaiting: true` and `clientsClaim: false` (BUG-01 third iteration). The new SW activates silently in the background; users get the new version on the next reload without an in-app toast. The retired `autoUpdate` + reload-toast combination caused user-confusion regressions; the regression-guard test in `src/pwa/viteConfigPwa.test.ts` locks the current options.
- NEVER cache the HTML shell with a long max-age. Otherwise updates never reach users.

### iOS Safari quirks

- iOS Safari clears IndexedDB after 7 days of inactivity for sites that are not added to the home screen. Document this prominently in onboarding.
- `crypto.subtle` works on iOS Safari but only over HTTPS or `localhost`. Local file:// will not work.

## Testing

### fake-indexeddb

- `fake-indexeddb` is the only way to test Dexie code in Vitest without a browser.
- Reset the fake DB between tests with `indexedDB = new IDBFactory()`. Otherwise tests leak state.

### Playwright and crypto

- Playwright runs a real browser, so `crypto.subtle` works.
- Use a separate Playwright project for E2E with a clean storage state. Otherwise the master password from one test leaks into the next.

### Production E2E locally needs a fresh build first

- `make test-e2e-production` builds first since TD-22 (same pattern as
  `test-bundle-size: build`). The trap remains for a direct
  `npx playwright test --config playwright.config.production.ts`:
  it starts `vite preview`,
  which comes up even when `dist/` is missing, and then every test
  fails in the first onboarding step with
  `Timeout 15000ms exceeded while waiting on the predicate` at
  `fillNewPasswordPair`. The message points at the password helper,
  but the page under test is simply not the app. Measured 2026-11-24
  on `0a900ed`, Playwright 1.59.1, Chromium: without `dist/` 1 of 1
  failed, after `make build` 4 of 4 passed (same test filter).
- CI does not have this gap: the `E2E (Production)` job downloads the
  `production-build` artifact that the build job produced.
- Before a direct `npx playwright` run, run `make build`. With an old
  `dist/` the suite runs against the old bundle and says nothing, so
  rebuild after every source change, not only when `dist/` is absent.
- A full local run also needs the WebKit build that matches the
  installed Playwright version (`npx playwright install webkit`).
  Without it the WebKit project fails at launch with
  `Executable doesn't exist`. For a quick local check of one screen,
  limit the run to one engine and one test name (after `make build`):

  ```bash
  npx playwright test --config playwright.config.production.ts --project=chromium -g "<name>"
  ```

### Pre-commit hook and git worktrees (TD-25)

- Git resolves a relative `core.hooksPath` against the root of the
  worktree that commits. husky sets `.husky/_`, a generated,
  git-ignored directory. A linked worktree that never ran `npm ci`
  (for example one that only links the main checkout's `node_modules`)
  had no `.husky/_`, and git then runs no hook and says nothing.
  Measured 2026-11-26 on `ae20674`: a commit with a type error went
  through in such a worktree with exit 0.
- Since TD-25 `prepare` runs `scripts/setup-git-hooks.mjs` after
  `husky`. It sets `core.hooksPath` to the absolute path of the main
  checkout's `.husky/_`, so every worktree runs the hook of the main
  checkout. The setting is written when `npm ci` or `npm install` runs;
  a checkout set up before TD-25 needs one such run. Check with
  `git config core.hooksPath`: it must be an absolute path.
- The hook that runs is the main checkout's `.husky/pre-commit`, not the
  copy on the branch of the worktree. A change to the hook takes effect
  for all worktrees once the main checkout has it.
- `.husky/pre-commit` stops with a message when `node_modules/.bin` lacks
  one of its tools. Without that guard `npx tsc` would look for a
  package named `tsc` in the registry.
- What the hook checks and CI does not: Prettier. `lint-staged` formats
  the staged files, CI runs `make lint` and `make typecheck` but not
  `make format-check`. A file committed without the hook can therefore
  land unformatted (it did: the audit file fixed in TD-23).

### Stryker static mutants (vitest runner)

- Mutants flagged `static: true` can show up as "Survived" even when
  the suite demonstrably kills them: the vitest runner activates
  mutants per test, but static mutants execute during module load,
  before activation, so the mutated branch never runs. Symptoms: the
  report shows `testsCompleted` equal to the whole related suite and
  the same mutant flips between "Timeout" and "Survived" across
  machines (observed on profileRepository lines 85/94, TD-18).
- Before writing tests against such a survivor, verify it manually:
  apply the mutation in the source, run the module's test file, revert.
  If a test fails, the mutant is a false positive; document it instead
  of chasing it. Real survivors reproduce as green suites under the
  applied mutation.

## i18n

- Add new strings in DE and EN at the same time as the code. Adding them later guarantees they get forgotten.
- Never concatenate translated strings. Use placeholders: `t('greeting', { name })`.
- Date and number formatting goes through `Intl`, not through hardcoded formats.

## Documentation

- Decisions that affect the threat model go into `docs/decisions/` as ADRs. The format is short: Context, Decision, Consequences.
- The README must always reflect the current install instructions. If they change, update the README in the same commit.
