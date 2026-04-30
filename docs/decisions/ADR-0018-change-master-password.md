# ADR-0018: Change master password

**Date:** 2026-04-30
**Status:** Accepted

## Context

Phylax derives the AES-256-GCM data key from the master password via
PBKDF2-SHA256 with 1.2M iterations (ADR-0001). The salt is stored in
plaintext in the singleton `meta` row; every other row in IndexedDB
stores its domain data inside an encrypted `payload`. P-06 lets the
user change the master password without losing data.

A change-password flow has three problems to solve:

1. **Verify current password.** The user is already unlocked, so the
   in-memory `currentKey` is valid, but valid only proves the vault
   was unlocked *at some point*, not that the human at the keyboard
   right now knows the master password. A bystander or screen-share
   observer could change the password without authenticating.
2. **Re-encrypt the entire vault.** All encrypted rows across ten
   tables (`profiles`, `observations`, `lab_values`, `lab_reports`,
   `supplements`, `open_points`, `profile_versions`, `documents`,
   `document_blobs`, `timeline_entries`) plus the `meta.payload`
   verification token + AppSettings + AIConfig blob (ADR-0003) must
   be re-encrypted under the new key in a way that survives a
   browser-tab close partway through.
3. **Swap the in-memory key.** After on-disk re-encryption, the
   keyStore singleton must reference the new CryptoKey. The auto-lock
   timer must not fire mid-operation and clear the key while
   re-encryption is in progress.

This ADR documents the architecture decisions for that flow.

## Decision

### 1. Sudo-pattern verification of the current password

Re-derive the candidate key from the typed `currentPassword` and the
stored salt, then attempt to decrypt the existing `meta.payload`
verification token using that locally-derived key. Wrong password =
decrypt throws (AES-GCM auth tag mismatch). Right password = key
matches the on-disk encryption.

This is independent of the keyStore singleton. The `currentKey` held
in memory is not consulted for verification; only the on-disk
ciphertext + the typed password are compared. The pattern matches
sudo-style re-authentication: prove identity right now, regardless of
prior session state.

### 2. Three-phase re-encryption

**Phase 1 - pre-stage (outside Dexie transaction).** Iterate every
encrypted table. For each row: read the encrypted payload, decrypt
with `oldKey` (local reference, not via the keyStore), encrypt with
`newKey`. Hold the re-encrypted `EncryptedRow[]` in memory per table.
Repeat for the singleton `meta.payload`. No database writes happen
in this phase.

**Phase 2 - atomic commit (inside one Dexie `rw` transaction).**
Open a single transaction over all encrypted tables + `meta`.
`bulkPut` the staged rows table by table. As the last operation
inside the same transaction, `db.meta.put` the new
`meta.payload`. Dexie commits atomically: either every payload
under newKey + meta updated, or rollback (every payload still under
oldKey + meta unchanged).

**Phase 3 - in-memory swap.** After the transaction commits,
`replaceStoredKey(newKey)` updates the keyStore singleton without
firing a `locked` lifecycle event (existing primitive shipped for
the backup-restore flow).

The crypto-outside-tx structure is mandatory: Web Crypto API returns
Promises, and Dexie commits a transaction the moment it detects an
`await` on a non-Dexie promise. Doing crypto inside the transaction
would commit the partial work mid-flight.

### 3. Same salt preserved

Salt is not rotated. PBKDF2's salt protects against precomputed
rainbow tables and ensures derivations across users diverge; it does
not need to rotate per-password. A new password derives a new key
from the same salt by construction. Rotating salt would require
writing the new salt to `meta.salt` mid-flow before the new
`meta.payload` lands, adding an extra failure surface for no
cryptographic gain.

Future migration to a different KDF (Argon2, scrypt) would be a
separate operation requiring salt rotation as part of the algorithm
change; that would warrant its own ADR.

### 4. Auto-lock paused for the duration

A reference-counted module-level pause primitive
(`src/features/auto-lock/pauseStore.ts`) gates the auto-lock timer.
The change-password operation calls `pauseAutoLock()` at start and
calls the returned `unpause` in a `finally` so the lock is released
on success and on failure. Multiple concurrent operations stack:
the timer resumes only when every consumer has released its pause.

This pattern is reusable: backup-restore (which already faces the
same problem implicitly) can adopt it later without changing the
contract.

The local-key-reference design in Phase 1/2 means even a buggy
auto-lock that fires mid-operation would not corrupt data - every
decrypt/encrypt uses local refs to `oldKey` / `newKey`, not the
keyStore singleton. The pause is belt-and-suspenders for Phase 3,
which calls `replaceStoredKey` whose precondition is
`currentKey !== null`.

### 5. No cancellation mid-operation

Once the user confirms the change, the operation runs to completion.
There is no cancel button. Half-cancelling a Dexie transaction is
not possible, and rolling back a pre-stage that has not yet written
anything is unnecessary. The simplest path - "start, finish, swap" -
has the smallest surface for a security-critical bug.

### 6. Partial-failure recovery behavior

Phase 1 fails: no on-disk writes happened. Vault unchanged. User
sees error.

Phase 2 fails (transaction rollback): no on-disk writes survive.
Vault unchanged. User sees error.

Phase 2 commits, then Phase 3 throws (should not occur in practice
if the pause primitive is correctly implemented -
`replaceStoredKey` throws only if `currentKey === null` which the
auto-lock pause is designed to prevent): vault is on-disk under
newKey, but the keyStore still holds oldKey. The user sees an error
toast. On the next page reload (or auto-lock + unlock), the user
enters the new password; unlock derives the new key from new
password + same salt; decrypt of `meta.payload` succeeds; vault
opens. No data loss; one extra reload to recover.

Specific failure modes that could exercise this path even with the
intended design: a reference-count off-by-one bug in the pause
primitive, a race between `pauseAutoLock()` and a synchronous lock
event, a future change to `replaceStoredKey` adding a new throw
condition without updating this flow, or browser tab suspension
during operation followed by re-entry. The recovery path is not
dead code.

The change-password UI surfaces this case explicitly via i18n keys
`settings:change-password.partial-failure` (DE + EN); see locales
for current strings. The DE string reads roughly: "Datenbestand
wurde verschlüsselt, aber Anwendung konnte den neuen Schlüssel
nicht aktivieren. Bitte einmal abmelden und mit dem neuen Passwort
wieder anmelden."

### 7. No memory cap for re-encryption

The pre-stage holds plaintext + ciphertext for every row in memory
during Phase 1. For typical vaults (hundreds of observations, dozens
of documents) this is megabytes. Worst case: many large
`document_blobs` (each capped at 5 MB by D-03's
`DOCUMENT_SIZE_LIMIT_BYTES`) could push the peak into hundreds of
MB. v1.0 ships single-user single-tab, so the peak is acceptable.

Streaming per-row (decrypt one, encrypt one, commit one) is not
compatible with atomic-tx semantics under the crypto-outside-tx
constraint. Adopting streaming would require either accepting a non-
atomic operation or building a journal table. Defer until a real
user reports an OOM.

## Consequences

- The pattern is reusable: `reencryptVault(oldKey, newKey)` can serve
  future flows that change the data key (key derivation parameter
  change, post-quantum migration, etc.) without re-deriving.
- Auto-lock pause primitive is now a reusable utility; backup-restore
  can adopt it.
- Sudo-pattern verification is a documented primitive; future
  security-flow features (rotate API key with re-auth, export
  encrypted backup, etc.) can reuse the same gate.
- Manual smoke required: security-critical flow with multi-step
  state machine, real-key derivation, and lock+unlock cycle.
  Smoke file at `docs/manual-smoke/p-06-change-password.md`.
- The "Phase 2 commit + Phase 3 throw" recovery path is documented
  in code (with a JSDoc reference back to this ADR), in the smoke
  file, and in the user-facing error message.

## Alternatives rejected

- **Re-derive a new salt at the same time as the new key.** No
  cryptographic gain (PBKDF2 salt does not rotate per-password by
  design); adds a failure surface (writing `meta.salt` mid-flow before
  `meta.payload` updates would corrupt the vault if the second write
  fails).
- **Streaming re-encryption (per-row decrypt+encrypt+commit).** Loses
  atomicity under crypto-outside-tx. A journal-table approach
  recovers atomicity at the cost of an extra schema migration and
  significantly more code. Defer until needed.
- **Rely on `currentKey` for verification (skip re-derive).** Fails
  the sudo-pattern test: an attacker physically present at an
  unlocked machine could change the password. Re-derive is cheap
  (one PBKDF2 call, ~1.6 s on mid-range phone, gated behind the
  same UX spinner the rest of the app uses).
- **Cancellation mid-operation.** Adds complexity to a security-
  critical path with negligible UX benefit. The whole operation is
  expected to take seconds to a couple of minutes for the largest
  vaults; a "Cancel" button risks half-done state if the
  implementation has bugs.

## Related

- ADR-0001: PBKDF2 iteration count (the cost factor that makes
  re-derivation feel slow but acceptable).
- ADR-0003: meta.payload includes settings (one of the artifacts
  that must be re-encrypted in Phase 1).
- ADR-0006: Auto-lock timer strategy (pause primitive integrates
  with the existing `setTimeout`-based timer).
