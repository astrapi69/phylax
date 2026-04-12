# src/ui

Shared, reusable UI components. These are "dumb" components with no domain knowledge, no data fetching, and no business logic. They receive props and render UI.

All styling uses Tailwind utility classes. Every component must work at 360px width (mobile-first) and support dark mode via the `dark:` variant.

## What does NOT belong here

- No domain logic. Validation and transformations belong in `src/domain/`.
- No data fetching or repository calls. Data comes from parent components via props.
- No feature-specific components. Those belong in their respective `src/features/` folder.
- No CSS files. Styling is Tailwind-only, except for `src/index.css`.

## Planned contents

- `Button.tsx` (F-16): primary, secondary, danger button variants
- `Input.tsx` (F-16): text input with label and error state
- `Modal.tsx` (E-13): confirmation and action modals (replaces `confirm()`)
- `Toast.tsx` (P-10): success, warning, error notifications
- `Spinner.tsx` (F-12): loading indicator for async operations
- `index.ts`: public API re-exports
