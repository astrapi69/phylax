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
- Use `vite-plugin-pwa`'s `autoUpdate` mode and show a "New version available, reload" toast.
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

## i18n

- Add new strings in DE and EN at the same time as the code. Adding them later guarantees they get forgotten.
- Never concatenate translated strings. Use placeholders: `t('greeting', { name })`.
- Date and number formatting goes through `Intl`, not through hardcoded formats.

## Documentation

- Decisions that affect the threat model go into `docs/decisions/` as ADRs. The format is short: Context, Decision, Consequences.
- The README must always reflect the current install instructions. If they change, update the README in the same commit.
