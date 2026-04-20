# ADR-0014: zxcvbn-ts for Password Strength Estimation

## Context

The master password is the sole protection for every encrypted row in
Phylax. A weak password undermines AES-256-GCM no matter how solid the
crypto layer is. The first-run SetupView (ONB-01c) needs a strength
indicator that goes beyond length-and-character-class heuristics.

The existing `estimateStrength()` in `src/features/onboarding/passwordValidation.ts`
applies three tiers (weak/fair/strong) based on length, character
classes, and a small blocklist of common patterns. It cannot detect
sequential keyboard walks, date patterns, leetspeak of common words,
or context-specific tokens like "phylax". A user who types
`Phylax2026!` gets green-lighted as "strong" even though the pattern
is trivially enumerable.

`zxcvbn` (Dropbox, 2012) is the industry reference for realistic
strength estimation. It models adversarial search against common
passwords, dictionaries, keyboard patterns, dates, and repetitions,
returning a log10 estimate of guesses needed plus a 0-4 score.

### Options considered

- **Option A (keep heuristic)**: no new dependency, but weak signal.
  Does not match the stakes of a local-first encrypted app where
  password loss = data loss.
- **Option B (Dropbox `zxcvbn`)**: canonical library. No types, pure
  JavaScript. An active fork is preferred by the TypeScript community.
- **Option C (`@zxcvbn-ts/core` + `language-common` only)**:
  TypeScript rewrite of zxcvbn. Load the core + common pack only
  (passwords list, diceware wordlist, keyboard adjacency graphs). Skip
  `language-en` / `language-de`, which are dominated by name and
  wikipedia dictionaries.
- **Option D (`@zxcvbn-ts/core` + all language packs)**: maximum
  scoring fidelity but roughly 1.1 MB additional gzipped on the first
  visit to /setup. Rejected on budget grounds.

### Size impact

Measured gzipped after Vite production build with dynamic import
(ONB-01c):

| Chunk                        | Raw (KB) | Gzipped (KB) |
| ---------------------------- | -------- | ------------ |
| `@zxcvbn-ts/core`            | 26       | 9.5          |
| `@zxcvbn-ts/language-common` | 465      | 232          |
| `@zxcvbn-ts/language-en`     | 1216     | 565          |
| `@zxcvbn-ts/language-de`     | 817      | 366          |

Loading en + de packs would add ~931 KB gzipped for the first visit to
/setup. The common pack contains the leaked-password list (388 KB
raw), the diceware wordlist, and keyboard adjacency graphs. That pack
alone catches the dominant risks: common passwords, keyboard walks,
and diceware mnemonics. Names and wikipedia terms add marginal
fidelity at disproportionate cost.

## Decision

Adopt **Option C**: ship only `@zxcvbn-ts/core` and
`@zxcvbn-ts/language-common`, both via **dynamic import on SetupView
mount**.

Specific points:

1. **Not on the critical path**: the library loads when the user
   reaches `/setup`. It does not affect the welcome/privacy screens,
   the unlock screen, or any post-setup view.
2. **Heuristic fallback**: the existing `estimateStrengthSync`
   function stays as a synchronous fallback. While the lazy import
   resolves, and if it ever fails (offline, cache miss, CSP quirk),
   the strength indicator still works at heuristic fidelity. The
   submit gate never depends on the async scorer.
3. **No language packs**: skip name + wikipedia dictionaries for now.
   Revisit if real-world feedback shows users picking common names as
   passwords and getting "strong" ratings. Revisit is cheap because it
   only requires changing `useLazyZxcvbn.ts` plus the allowed-list.
4. **Score threshold**: the UI maps the 0-4 zxcvbn score to
   weak/fair/strong (same tiers as the heuristic: 0-1 = weak, 2 = fair,
   3-4 = strong). Length gate (12 chars minimum) remains the hard
   requirement. Submit enables at length >= 12 regardless of
   strength tier; strength is advisory.
5. **No feedback string display**: zxcvbn returns a `feedback` object
   with `warning` and `suggestions` strings. These are English-only
   library text; surfacing them would break i18n. We use the score
   only.

## Consequences

- Combined lazy chunk ~242 KB gzipped, loaded once per install on
  first visit to `/setup`. Cached by the service worker for
  subsequent visits. Not on the critical path for returning users
  (who land on /unlock, not /setup).
- Main bundle stays within ADR-0013's 250 KB budget (measured: 206
  KB gzipped after ONB-01c).
- Strength indicator detects real-world weak passwords (keyboard
  walks, leaked-password list + leetspeak, date patterns, diceware
  mnemonics) instead of only length and character-class variety.
- Setup flow gains a small lazy-load delay on first keystroke after
  mount. Pre-warmed on mount via `useEffect` so the library is ready
  by the time the user finishes typing.
- New dependency surface: two packages, both from the `@zxcvbn-ts`
  scope on npm. Maintained by the `zxcvbn-ts` organization (active,
  TypeScript-first). Added to the allowed-list in
  `.claude/rules/coding-standards.md`.
- The heuristic `estimateStrengthSync` stays in the codebase as a
  fallback. Future ADR may remove it once we are confident the lazy
  import is reliable in all supported browsers + PWA offline modes.

## Security note

zxcvbn runs entirely in-browser. It does not contact any network, does
not persist the password, and does not log the password anywhere.
Confirmed by:

- Source inspection of `@zxcvbn-ts/core@3.0.4` (no `fetch`, no
  `XMLHttpRequest`, no `navigator.*` beyond type definitions).
- Chrome DevTools network tab: zero requests during password typing.

The library reads the password string once per invocation and returns
a numeric score plus metadata. No password-derived material leaves the
function.

## Implementation

- `src/features/onboarding/useLazyZxcvbn.ts`: dynamic import wrapper.
  Returns `{ ready, error, score }` where `score(pw) => 0..4`.
- `src/features/onboarding/passwordValidation.ts`:
  - rename existing `estimateStrength` -> `estimateStrengthSync`
  - add `strengthFromZxcvbnScore(score): PasswordStrength`
  - add `validateSetup(password, confirm, acknowledged):
SetupValidationResult` with discriminated-union error.
- `.size-limit.json`: add per-chunk entries to keep the combined
  zxcvbn chunk within the documented 242 KB gzipped budget so growth
  surfaces in CI.
