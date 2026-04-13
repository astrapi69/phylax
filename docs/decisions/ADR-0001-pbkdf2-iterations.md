# ADR-0001: PBKDF2 Iteration Count

**Date:** 2026-04-13
**Status:** Accepted

## Context

PBKDF2 iteration count directly determines the cost of brute-forcing a master password. Higher iterations mean slower key derivation for both the user (once, on unlock) and the attacker (millions of times, per guess).

OWASP recommended 600,000 iterations for PBKDF2-SHA256 as of 2023. Hardware improvements since then (faster GPUs, cheaper cloud instances) push the practical recommendation toward 1M+ for 2026.

Phylax derives a single AES-256-GCM key from the master password on each unlock. The derivation is a one-time cost per session. The user experiences it as a brief spinner, not as ongoing latency.

This decision must be made before F-10 (Dexie schema) because once ciphertexts are persisted against a specific iteration count, changing the count requires a migration strategy: derive with the old count to decrypt, re-encrypt with the new count.

## Decision

Set `PBKDF2_ITERATIONS` to **1,200,000** (1.2 million).

This doubles the OWASP 2023 baseline. On a mid-range phone (Moto G class), derivation takes approximately 600ms to 800ms. On a desktop or modern phone, approximately 300ms to 500ms.

## Consequences

- **User experience:** Unlock takes under 1 second on mid-range hardware. A spinner is shown during derivation. No perceived freeze.
- **Attacker cost:** Each password guess costs 1.2 million SHA-256 iterations. Doubles brute-force cost compared to the 600k baseline.
- **Commitment:** Once profiles are persisted (F-10 onward), this count is locked for those records. Changing it later requires a re-encryption migration.
- **Future adjustment:** If hardware trends warrant a further increase, it should happen before the first stable release (v1.0), not after.
