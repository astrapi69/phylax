# src/features/settings

Settings screen for user preferences and security-relevant
operations.

`SettingsScreen.tsx` is the host component; the rest of the folder
is one section component per concern. Each section owns its own
state and side effects; the screen just composes them.

## Sections (top to bottom)

| Component                                                   | Concern                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ThemeSection`                                              | Light / dark / auto theme toggle (Theme Context, ADR-0009)                                                          |
| `LanguageSection`                                           | UI language switcher; persisted via `phylax-language` localStorage key (I18N-02)                                    |
| `AutoLockSection`                                           | Auto-lock minutes preset (1 / 5 / 15 / 30 / 60), persisted into the encrypted `MetaPayload.settings` (P-05)         |
| `ChangePasswordSection`                                     | Master password change with sudo-pattern verification + atomic vault re-encryption (P-06, ADR-0018)                 |
| `AISettingsSection` (re-exported, `../ai-config`)           | AI-provider summary card + lazy-loaded multi-provider wizard (AIP-01..05, ADR-0019)                                 |
| `BackupExportSection` / `BackupImportSection` (re-exported) | Encrypted vault round-trip (Phase 6)                                                                                |
| `LegalSection` (re-exported, `../legal`)                    | License + ADR / CONCEPT links (P-12)                                                                                |
| `DangerZoneSection`                                         | Full reset (clears IndexedDB + localStorage + sessionStorage); destructive, gated behind a `<ConfirmDialog>` (O-20) |

## Architecture rules

- No direct `crypto.subtle` calls. Password change routes through
  `src/crypto/` (key derivation, re-encryption helpers).
- No Dexie imports. Re-encryption iterates encrypted repositories
  through `src/db/repositories/`.
- No shared UI components defined here. Reusable UI lives in
  `src/ui/` (modal primitive, `PasswordVisibilityToggle`, etc.).
- Each section component is independently testable; integration
  with `SettingsScreen` is verified by `SettingsScreen.test.tsx`
  composing them under one router.

## Hooks

- `useChangeMasterPassword` (`useChangeMasterPassword.ts`): drives
  the change-password state machine (idle → verifying →
  reencrypting → done / error). UI consumes status + error
  variants and renders inline messages without lifting state.

## File map

| File                         | Role                                                  |
| ---------------------------- | ----------------------------------------------------- |
| `SettingsScreen.tsx`         | Composes all sections under the `/settings` route     |
| `ThemeSection.tsx`           | Theme toggle                                          |
| `LanguageSection.tsx`        | Language switcher                                     |
| `AutoLockSection.tsx`        | Auto-lock preset buttons                              |
| `ChangePasswordSection.tsx`  | Master password change form + confirm modal           |
| `useChangeMasterPassword.ts` | Hook backing the change-password flow                 |
| `DangerZoneSection.tsx`      | Full reset (calls `useResetAllData` from `../reset/`) |
| `index.ts`                   | Public API re-exports                                 |

Tests sit next to each component in `*.test.tsx` form.
