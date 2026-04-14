# ADR-0009: Theme State Management

## Context

Phylax needs a dark mode to be comfortable to use on mobile devices and in low-light environments. The theme choice must persist across reloads, respect the system preference when the user has not expressed one, and apply without a visible flash of the wrong theme on load. It also needs to work on screens that render before the IndexedDB database is available (onboarding and unlock), because asking someone to unlock the app with a bright white flash is both irritating and, for some users, accessibility-breaking.

Two persistence options exist: IndexedDB (the rest of Phylax's data) or localStorage (the web platform's default for preferences). And two UX options exist: a binary toggle (light / dark) or a three-state toggle (light / dark / auto).

## Decision

### Persistence: localStorage

Theme lives in `localStorage` under the key `phylax-theme`. Values: `'light'`, `'dark'`, or `'auto'` (the default on first visit).

- Theme must be readable before React mounts to avoid a flash on the unlock screen. IndexedDB reads are async and happen after the key store is primed, which is too late.
- Theme is not sensitive. Encrypting it buys nothing, costs synchronicity.
- `localStorage` is the universal convention for this class of preference. Libraries and browsers assume this.
- Rapid toggle during settings tweaks does not race against IndexedDB transactions.

### Three-state model

`light` / `dark` / `auto`. `auto` resolves reactively to the current value of `window.matchMedia('(prefers-color-scheme: dark)')`. When a user in `auto` changes their system theme, Phylax follows without a reload.

The alternative (binary toggle with an implicit auto-follow on first load) hides the third state from the user and gives no way to say "always dark, even on a light-themed system". The explicit third option is worth the one extra radio.

### Flash prevention

An inline script in `<head>` runs synchronously before any React code and before stylesheets paint. It reads `localStorage['phylax-theme']`, resolves `auto` via `matchMedia`, and adds the `dark` class to `<html>` when appropriate. React's `ThemeProvider` takes over after mount and handles subsequent changes via the same `dark` class.

The script is wrapped in `try/catch` because `localStorage` can throw in Safari private mode and some embedded webviews. Any failure falls through to the light theme.

### Mobile status bar

Two `<meta name="theme-color">` tags in `index.html` use the `media` attribute to switch the mobile browser's status bar color when the system theme changes. `media` is ignored on older browsers, which then use the first tag as a static fallback. Acceptable.

## Canonical color token mappings

These are the light-to-dark mappings used across the codebase. Future UI tasks use this table as the reference rather than inventing new pairs:

| Light class        | Dark class              | Usage                                      |
| ------------------ | ----------------------- | ------------------------------------------ |
| `bg-white`         | `dark:bg-gray-900`      | Main surfaces, app shell background        |
| `bg-gray-50`       | `dark:bg-gray-800`      | Elevated cards, distinct panels            |
| `bg-gray-100`      | `dark:bg-gray-800`      | Secondary surfaces, subtle chrome          |
| `text-gray-900`    | `dark:text-gray-100`    | Primary text                               |
| `text-gray-700`    | `dark:text-gray-200`    | Medium-emphasis text                       |
| `text-gray-600`    | `dark:text-gray-400`    | Secondary text, labels                     |
| `text-gray-500`    | `dark:text-gray-400`    | Placeholder text, hints                    |
| `border-gray-200`  | `dark:border-gray-700`  | Default borders, dividers                  |
| `border-gray-300`  | `dark:border-gray-600`  | Input borders, interactive edges           |
| `bg-blue-600`      | `dark:bg-blue-500`      | Primary button surface                     |
| `text-blue-700`    | `dark:text-blue-300`    | Active nav link, primary link              |
| `bg-blue-50`       | `dark:bg-blue-950/40`   | Active nav link background, selected state |
| `bg-red-50`        | `dark:bg-red-950/40`    | Error banner background                    |
| `text-red-800`     | `dark:text-red-200`     | Error banner text                          |
| `border-red-200`   | `dark:border-red-800`   | Error banner border                        |
| `bg-amber-50`      | `dark:bg-amber-950/40`  | Warning sign background                    |
| `border-amber-300` | `dark:border-amber-700` | Warning sign border                        |
| `text-amber-900`   | `dark:text-amber-200`   | Warning sign text                          |
| `bg-green-600`     | `dark:bg-green-500`     | Success button                             |
| `text-green-700`   | `dark:text-green-400`   | Success text                               |
| `prose`            | `dark:prose-invert`     | Markdown-rendered content                  |

Palette choices:

- Dark surfaces use `gray-900` rather than `black` so shadows and borders stay visible.
- Semantic tints (amber, red, blue) use a `-950/40` background so the color intent survives while reading well on dark.
- Primary buttons shift from `-600` to `-500` in dark because the darker shades disappear against `gray-900`.

## Consequences

### Positive

- One place (`<ThemeProvider>`) owns the state. Every component reads via `useTheme()` or, more commonly, via the `dark:` class and Tailwind's variant system.
- Flash-free on first load, including the unlock screen.
- Auto mode lets users who change their system theme at sunset have the app follow without touching Phylax.
- The ADR color table prevents drift in future view tasks.

### Trade-offs

- localStorage is not encrypted. A user with disk access to an unlocked device could read the theme preference. This is not data worth protecting.
- Changing the default from `auto` to something else would require a migration step reading the old key. Deferred until it's actually needed.
- The inline script is duplicated logic from `themeStorage.ts` (both read the same key, both resolve `auto`). Acceptable: removing the script would reintroduce the flash, and extracting it into a shared file runs into the bootstrap-ordering problem the script was introduced to solve.
