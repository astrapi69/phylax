# ADR-0004: Encrypted blob per row

**Date:** 2026-04-13
**Status:** Accepted

## Context

Phylax encrypts health data in IndexedDB. Three options for encryption granularity were considered:

1. **Plaintext + master password gate**: no encryption, just access control at the app level.
2. **One encrypted blob per row**: plaintext only for indexed structural fields (id, profileId, timestamps), all content in a single `payload: ArrayBuffer`.
3. **Granular per-field encryption**: each field encrypted separately with its own IV.

## Decision

Option 2: one encrypted blob per row.

Each row stores plaintext id, profileId, createdAt, updatedAt, and a single `payload` containing IV + ciphertext + auth tag (AES-256-GCM, per F-07's wire format). All domain content (theme, fact, pattern, status, etc.) lives inside the encrypted payload.

## Consequences

- Simpler code: one encrypt/decrypt operation per row, one serialization format.
- Leaks row count and approximate row size to an observer of the encrypted store.
- Does NOT leak which fields are populated (option 3 would reveal this via the presence or absence of individual encrypted field columns).
- Acceptable for Phylax's threat model: single-user, single-device. An attacker would need physical or remote-shell access to the device, in which case row metadata is the smallest concern.

## Alternatives rejected

- **Option 1**: anyone with disk access reads everything. Violates the zero-knowledge principle.
- **Option 3**: high code complexity (per-field IVs, per-field decrypt), and the metadata leak (which fields exist per row) is worse than option 2's leak (count/size).
