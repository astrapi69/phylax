# src/lib

Tiny utility functions with no domain knowledge. Pure helpers that could exist in any project.

If a utility grows beyond five lines or starts to encode domain rules, it belongs in `src/domain/` instead. No lodash, no moment.js; use native methods or write a small function.

## What does NOT belong here

- No React imports. React utilities (hooks, context) belong in their respective features.
- No domain logic. Validation, transformations, and business rules belong in `src/domain/`.
- No crypto or storage logic.
- No third-party utility libraries (lodash, ramda, date-fns). Use native methods.

## Planned contents

- Small helper functions as needed during development (no specific ROADMAP tasks target this folder directly; it grows organically)
- `index.ts`: public API re-exports
