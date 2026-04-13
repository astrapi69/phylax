# ADR-0005: No content field indexes

**Date:** 2026-04-13
**Status:** Accepted

## Context

IndexedDB (via Dexie) supports indexing fields for fast queries. Content fields like `theme`, `status`, and `timing` would speed up filtering and grouping. However, indexed fields must be stored as plaintext because encrypted bytes cannot be meaningfully indexed (the same plaintext encrypts to different ciphertexts due to the random IV).

The question: which fields to index?

## Decision

Index only structural metadata:

- `id` (primary key)
- `profileId` (multi-profile routing)
- `[profileId+createdAt]` compound index on chronological tables (observations, lab_values, profile_versions)

All content fields (theme, fact, pattern, status, timing, parameter names, etc.) remain inside the encrypted payload. Filtering and grouping happen in-memory after decryption.

## Consequences

- An observer of IndexedDB cannot infer health metadata: which themes the user tracks, how many open vs closed items exist, supplement schedules.
- In-memory filtering is acceptable for the dataset size: single user, personal profile, hundreds to low-thousands of records.
- Complex queries load and decrypt all matching profile rows, then filter in JavaScript. This is O(n) per profile, not O(1), but n is small.
- If the dataset ever grows large enough to make in-memory filtering slow, a re-evaluation of this decision is needed. That threshold is estimated at 10,000+ records per profile.

## Alternatives rejected

- **Indexing content fields (theme, status, timing)**: leaks health metadata to anyone with disk access. Marginal performance gain does not justify the privacy cost.
- **Hashed indexes**: hashes leak the same metadata when the value space is small. Theme has few distinct values and is easily enumerable via rainbow table.
