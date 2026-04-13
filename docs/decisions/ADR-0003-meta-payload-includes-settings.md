# ADR-0003: Meta payload includes settings

**Date:** 2026-04-13
**Status:** Accepted

## Context

F-12 wrote only the verification token string (`'phylax-verification-v1'`) into the encrypted meta payload. F-14 introduces user-configurable settings (auto-lock timeout) that must persist across sessions and survive reloads.

Settings belong in the encrypted portion of meta because they are per-installation configuration that should not be readable without the master password (e.g., a custom timeout value is a minor privacy signal).

Two options were considered:

1. Expand the meta payload to a JSON object containing both the verification token and settings.
2. Create a separate `settings` table with its own encrypted row.

## Decision

Option 1: expand the meta payload to JSON.

```json
{
  "verificationToken": "phylax-verification-v1",
  "settings": {
    "autoLockMinutes": 5
  }
}
```

The verification token and settings are decrypted together on every unlock. No additional decrypt operation or table access needed.

## Consequences

- **Backward compatibility:** F-12 meta rows contain a bare string, not JSON. The reader detects the format and falls back to default settings for legacy payloads. No migration step required.
- **Future settings:** new fields are added to the `settings` object. Missing fields fall back to defaults. No schema migration needed for additive changes.
- **Pre-release impact:** minimal. No end users have data yet.
