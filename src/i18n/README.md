# src/i18n

i18next setup and translation files. Initial languages: German (DE) and English (EN).

All user-facing strings go through `i18next`. Never concatenate translated strings; use placeholders instead: `t('greeting', { name })`. Date and number formatting uses `Intl`, not hardcoded formats. New strings must be added in both DE and EN at the same time as the code that uses them.

## What does NOT belong here

- No React components. This module provides the translation function, not UI.
- No domain logic or business rules.
- No hardcoded date or number formats. Use `Intl.DateTimeFormat` and `Intl.NumberFormat`.

## Planned contents

- `de.json` (P-03): German translations
- `en.json` (P-03): English translations
- `index.ts` (P-03): i18next initialization and configuration
