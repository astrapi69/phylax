# ADR-0023: Soft-Reset (data wipe with master-password preservation)

**Date:** 2026-05-06
**Status:** Accepted (implementation complete)

## Context

Phylax shipped a single destructive-action surface in the settings
danger zone: the full hard-reset (`useResetAllData`,
`ResetDialog`). Hard-reset deletes the entire Dexie database, wipes
every Phylax-prefixed `localStorage` / `sessionStorage` key, clears
caches plus the service worker, and reloads the app to onboarding.
That flow assumes the user wants to start over completely, including
master-password rotation and full re-onboarding.

The existing hard-reset path deletes all profile data but couples
the wipe to a forced master-password change and full re-onboarding,
including a PBKDF2 re-derivation (per ADR-0001, 1.2M iterations,
~1.6s on commodity hardware). This coupling is friction for users
who want a fresh data slate without rotating their password or
losing their AI configuration. Soft-reset closes that gap: same
data wipe, same in-memory crypto key, same AI configuration, same
preferences. No re-onboarding.

The Soft-Reset feature addresses this by introducing a second,
lower-friction destructive surface that wipes profile data only and
preserves authentication state, AI configuration, and user
preferences. It ships as an additive feature; the hard-reset path is
unchanged and remains the right tool for "fully forget me" intent.

This ADR records the architectural decisions taken across the
six-step Soft-Reset track (commits `accb3e4`, `6aaf45d`, `cdf7d3e`,
`dc0aaca`, this commit, and the upcoming CHANGELOG closure).

## Decision

### 1. Two reset modes with explicit boundary

Two separate reset paths coexist in the danger zone:

- **Soft reset** (`useSoftReset` + `SoftResetDialog`): wipes profile
  data tables only. Preserves `meta` (salt, verification token,
  onboarding flag, encrypted AI config), the in-memory `CryptoKey`
  in the keystore singleton, every user-preference storage key,
  and every security-rate-limiter key. The user stays unlocked.
  Caller-decided post-reset destination (typically
  `/profile/create`).
- **Hard reset** (`useResetAllData` + `ResetDialog`): full
  destructive flow. Unchanged from the pre-soft-reset
  implementation.

The boundary is non-negotiable: each path owns its own hook, dialog,
locale namespace, and test surface. There is no shared "reset core"
abstraction. Reasoning: the two flows differ in every dimension that
matters (transaction scope, key lifecycle, navigation, locale
challenge), and forcing them through a common abstraction would mean
either a leaky union type or a coordinator with two branches. Two
sibling implementations is the smaller surface.

### 2. Wipe matrix (data tables vs everything else)

Soft reset opens one Dexie `'rw'` transaction over exactly the ten
data tables and calls `Table.clear()` on each:

| Wiped (data tables)                                  | Kept (auth + config + prefs)            |
| ---------------------------------------------------- | --------------------------------------- |
| `profiles`, `observations`                           | `meta` (salt + payload + onboarding)    |
| `lab_reports`, `lab_values`                          | In-memory `CryptoKey` (keystore)        |
| `supplements`, `open_points`                         | `phylax-language`, `phylax-theme`       |
| `profile_versions`, `documents`                      | Sort + display preferences              |
| `document_blobs`, `timeline_entries`                 | AI disclaimer ack, donation flag        |
| `phylax.persistence.*` localStorage (profile-scoped) | Rate-limiter keys (`phylax.*` security) |

The `meta` table is excluded from the transaction scope. Salt,
schema version, and the encrypted `meta.payload` (which carries
AppSettings + multi-AI-provider config per ADR-0019) all stay
byte-equal preserved. `localStorage` wipe is scoped by the
`/^phylax\.persistence\./` regex; profile-scoped UI state
(currently only `phylax.persistence.dismissed.{profileId}` from
PersistentStorageBanner) is the only matched surface.

Dropping the `phylax.persistence.*` keys is the one place soft
reset crosses the Dexie boundary. Without it, `dismissed.<old-id>`
would dangle past the wipe and leave the new profile's
PersistentStorageBanner mis-stated. New profile-scoped storage
keys MUST follow the `phylax.persistence.*` prefix to participate
in soft reset; the convention is documented inline in
`useSoftReset.ts` and on `CLAUDE.md`'s Browser-Storage-Key
section.

### 3. In-memory crypto key continuity

The keystore singleton (`src/crypto/keyStore.ts`) is NOT touched
during soft reset. `getLockState()` stays `'unlocked'` across the
wipe. The user does not see a lock screen and does not retype the
master password.

Reasoning: the cryptographic invariant on which Phylax's threat
model depends is "the key in memory is the key derived from the
typed master password" (ADR-0001 plus ADR-0018). Soft reset does
not change the master password, so the key in memory is still
correct. Calling `lock()` would force an unnecessary re-derivation
(1.6 s on a mid-range phone per ADR-0001) for no security benefit.
The wiped profile data will be encrypted under the same key on
the next write.

This matches the design contract of the Step 1 hook: "soft reset is
a pure-storage operation, not an auth-state operation". The Step 4
DangerZoneSection consumes the hook unchanged; the
`useSoftReset.test.ts` "keeps in-memory crypto key" assertion
locks this guarantee.

### 4. Locale-aware type-challenge (LOESCHEN / CLEAR vs hard-reset's RESET)

The soft-reset confirmation challenge is locale-aware:

- DE: type `LOESCHEN` to confirm.
- EN: type `CLEAR` to confirm.

This contrasts with hard-reset's locale-independent English token
`RESET` defined in TS. The hard-reset rationale follows the
"git-command-not-translated" convention as documented in the
soft-reset locale commit (6aaf45d); the typed token is a
developer-facing primitive.

Soft reset is a more user-facing, more frequent destructive
gesture. A user-typed challenge in the user's own language reduces
the cognitive overhead of "translate this English word in your head
before typing it" without weakening the friction the challenge is
designed to provide. The full-uppercase format is preserved so the
challenge still feels like a deliberate copy gesture, not a casual
input. ASCII-safe form (`LOESCHEN` not `LOSCHEN` or `LOSCHEN`
without umlaut) avoids keyboard-layout friction on systems where
the umlaut may not be reachable.

The challenge is i18next-driven (`reset:soft.challenge`) so future
locales (ES, FR, EL per ROADMAP P-11) can supply their own token
without code changes. The component test suite covers DE plus EN
explicitly; new locales are gated by P-11 scope.

### 5. Two separate dialogs over mode-toggle in a single dialog

`SoftResetDialog` and `ResetDialog` are sibling components, NOT a
single dialog with a mode toggle. The two dialogs duplicate some
chrome (modal primitive, focus trap, challenge input pattern) but
diverge meaningfully in:

- Title and warning copy.
- Wiped vs kept lists (soft reset shows two columns; hard reset
  shows none, the warning is a single block).
- Challenge token (locale-aware vs English-constant).
- Progress and partial-failure messages.
- Retry semantics (soft reset re-enables the primary action on
  partial failure; hard reset has its own blocked-by-other-tab
  state).
- Locale namespace (`reset:soft.*` vs `reset:dialog.*`).

A unified mode-toggle dialog was considered and rejected. A toggle
inside a destructive-action dialog gives the user one extra place
to misclick during a high-stakes gesture, dilutes the visual
distinction between "wipe data" and "wipe everything", and forces
the locale code to branch on mode at every string lookup.
Rejecting the unified dialog at the dialog layer keeps the danger
zone's two surfaces visually and semantically distinct from the
moment the user enters either dialog.

The one shared utility is the modal primitive
(`src/ui/Modal/...`) and the focus-management convention
(`initialFocusRef={cancelButtonRef}`). That layer is shared
across every destructive dialog in the app and predates soft reset.

### 6. Two-button-stacked UI in DangerZoneSection

Both triggers are surfaced simultaneously in
`DangerZoneSection`, stacked vertically with the soft-reset trigger
above the hard-reset trigger:

- Soft (top): `Profildaten löschen (Passwort behalten)` /
  `Clear profile data (keep password)`.
- Hard (bottom): `Alle Daten löschen` / `Delete all data`.

Both triggers hide while either dialog is open
(`openDialog === null` gate) to prevent accidental cross-clicks
during a destructive flow. The stack uses `flex flex-col gap-2`
and a 44px minimum hit-target per the project's a11y baseline.
Trade-off: switching from soft-reset to hard-reset mid-flow
requires Cancel then re-click on the hard trigger (two clicks).
Acceptable friction for destructive operations.

The "soft above hard" order surfaces the lower-friction option
first. Users scanning the danger zone read top-to-bottom; placing
soft first makes it the default visual choice for users who do
not need the full reset, while keeping the hard reset reachable
for users who do.

A "soft-reset-first, hard-reset-only-on-link" alternative was
considered (one button visible by default, hard-reset hidden behind
a "show advanced options" disclosure). Rejected: hides a critical
recovery primitive behind UI friction at the moment a user is most
likely to need it. The explicit two-button stack keeps both paths
first-class.

### 7. Visual differentiation: amber soft vs red hard

The two triggers use different outline colors to reinforce the
"different severity" mental model:

- Soft: amber-400 / amber-600 outline, amber-800 / amber-300 text,
  amber-50 / amber-900-30 hover.
- Hard: red-300 / red-700 outline, red-700 / red-300 text, red-50 /
  red-900-30 hover.

Amber matches the project's existing "warning, recoverable" palette
(used in the "duplicates may occur" warnings on import and the
storage-not-persistent banner). Red matches the existing
"destructive, irrevocable" palette (used on document delete and
the hard-reset trigger pre-soft-reset). The colour mapping is
consistent with prior patterns in the codebase; soft-reset is not
introducing a new color semantic.

A monochrome alternative (both triggers red, differentiated only
by label) was considered and rejected. Visually identical
destructive triggers force the user to read both labels before
deciding, which is the opposite of the intended "scannable danger
zone" UX. The amber-vs-red colour pair takes the "different
severity" signal off the label and onto the visual hierarchy.

### 8. Navigation strategy after successful soft reset

On successful submission (`onSubmitted(true)`),
`DangerZoneSection` calls
`navigate('/profile/create', { replace: true })` via React Router's
`useNavigate` hook. The destination route is the empty-vault entry
point that re-renders against the now-empty profile state.

The `replace: true` semantic intentionally drops the
`/settings` entry from the history stack. After a successful soft
reset the settings screen no longer has a profile to operate on;
leaving `/settings` in history would invite a Back-button bounce
into a stale view that crashes or re-routes the empty-vault
guard.

`location.replace('/profile/create')` was rejected as the
navigation primitive: a hard URL replacement triggers a full page
reload, which forces the user through master-password unlock again
(the in-memory key is cleared on reload), defeating Decision 3's
"key continuity" guarantee. React Router's client-side
`navigate(..., { replace: true })` keeps the in-memory key alive
across the route transition.

The "stay on `/settings` with a state banner" alternative was
considered for "do nothing dramatic, let the user pick the next
step" UX. Rejected: the settings screen depends on a profile
being available for the change-password section, the lock-timer
section, and the AI config section, and the soft reset has just
removed that profile. Routing the user to a screen that matches
the new state is cleaner than refactoring three settings sections
to handle the no-profile case.

### 9. Profile-Context invalidation via route change, not explicit primitive

There is no explicit `profileContext.invalidate()` or
`refetchProfile()` call in the soft-reset flow. Profile state
re-evaluates implicitly when the user navigates to
`/profile/create`: the route boundary triggers the route's data
loader (or initial-render fetch) which sees an empty `profiles`
table and renders the empty-vault flow.

A "soft reset, then call an explicit context primitive, then stay
on /settings" alternative was considered. Rejected for two
reasons: (1) it requires introducing a context-invalidation
primitive that does not exist today, expanding the React-Context
contract with a single consumer that is a destructive
side-effect; (2) it ties the soft-reset hook's implementation to
the consumer's context shape, breaking the "soft reset is a
pure-storage operation" contract from Decision 3.

Route-based implicit invalidation matches the React Router idiom
of "a route owns its own data" and keeps the soft-reset hook
decoupled from any particular consumer. If a future caller wants
post-reset behavior other than navigation (a hypothetical "soft
reset, then immediately import a new profile from file" flow),
that caller composes its own post-reset action; the hook does not
prescribe a destination.

The DangerZoneSection test
`partial-failure path keeps the dialog open and does NOT navigate`
locks the contrapositive: failed soft reset does not route, the
dialog stays open with the partial-failure alert and the
challenge already typed, ready for retry without a re-type.

## Consequences

Positive:

- Lower-friction recovery primitive for users who want to redo
  their profile without losing their master password, AI provider
  configuration, or UI preferences.
- AI configuration preserved: the multi-AI-provider config from
  ADR-0019 lives in the encrypted `meta.payload` and rides on the
  in-memory key. Soft reset's "no `meta` touch" guarantee
  preserves it for free; no integration test against AI config
  was needed because the decision is structural.
- Master password preserved: salt and verification token in
  `meta` survive, so the user keeps the same unlock token across
  the wipe.
- In-memory key continuity: no extra PBKDF2 derivation on the
  recovery path.
- Two-button visual hierarchy makes the choice scannable; users
  do not have to read the full label of two near-identical
  destructive triggers.
- Hard-reset path is unchanged; this is an additive feature, not
  a replacement.

Negative / accepted trade-offs:

- Two destructive paths require the user to differentiate them
  before clicking. The visual hierarchy plus the locale labels
  ("Profildaten löschen (Passwort behalten)" vs "Alle Daten
  löschen") carry that differentiation; if real-user feedback
  surfaces confusion, a polish marker would track it. None
  registered today.
- Per-locale type-challenge (`LOESCHEN` / `CLEAR`) is a small
  i18n maintenance overhead. Future locales (ES, FR, EL per
  P-11) supply their own token; the wiring is already in
  `reset:soft.challenge`.
- The `phylax.persistence.*` storage-key convention is now
  load-bearing for soft reset. New profile-scoped storage keys
  that drift from the prefix would silently survive a soft
  reset. Documented inline in the hook and on the
  Browser-Storage-Key-Convention section of `CLAUDE.md`.
- No polish markers registered for Soft-Reset. The four-step
  implementation closed without surfacing deferred work; the
  retry-on-partial-failure UX shipped as designed (Confirm
  re-enables, challenge stays typed) and the visual
  differentiation matches the existing amber-vs-red palette
  without further refinement needed. If the manual smoke walk
  surfaces findings, polish markers register at that point.

## Alternatives rejected

- **A1 - Single reset dialog with mode-toggle.** A unified dialog
  with a mode-switch radio at the top. Rejected: dilutes the
  destructive-action signal at the moment of clicking, doubles
  the locale-key surface inside one dialog, and forces both
  flows through a coordinator that branches at every string
  lookup. Two sibling dialogs are smaller surface (Decision 5).
- **A2 - Hard reset only (status quo).** Keep the single danger
  zone trigger and force users into full re-onboarding for any
  data wipe. Rejected: re-onboarding includes a 1.6 s PBKDF2
  derivation plus master-password retype on the recovery path
  every time, friction that delivers no security benefit when the
  user only wants to clear data without rotating their password.
- **A3 - Programmatic API only without UI.** Ship `useSoftReset`
  as a hook for future call sites without exposing a button in
  the danger zone. Rejected: defeats the purpose. Users need a
  self-service recovery primitive in the settings UI; an
  un-surfaced hook helps no one.
- **A4 - Mode-toggle inside the existing ResetDialog.** Variant
  of A1 that keeps the entry point as one button but offers
  soft / hard radio choice inside the dialog. Rejected for the
  same reasons as A1, plus: the existing ResetDialog's
  blocked-by-other-tab state and progress messaging are
  hard-reset-specific and would need conditional branches that
  break the dialog's current invariants.
- **A5 - Hard URL replace for navigation.** Use
  `location.replace('/profile/create')` instead of
  `navigate(..., { replace: true })`. Rejected: triggers a full
  reload, clears the in-memory key, forces master-password
  retype, defeats the "key continuity" guarantee from
  Decision 3.
- **A6 - Explicit profileContext.invalidate() primitive.** Add a
  context-invalidation method and call it from the dialog after
  a successful wipe. Rejected: introduces a
  destructive-side-effect primitive on the React Context with a
  single consumer, ties the hook to a specific consumer's
  context shape, breaks the pure-storage contract.

## Related ADRs

- **ADR-0001** PBKDF2-SHA256 1.2M iterations. The cost factor
  that motivates Decision 3's "do not re-derive on the soft-reset
  recovery path".
- **ADR-0018** Change master password (P-06 reencryption
  pipeline). Confirms that the encrypted `meta.payload` survives
  the soft-reset's `meta`-out-of-scope guarantee; Phase 1 of the
  P-06 pipeline is unaffected.
- **ADR-0019** Multi-AI-provider integration. The AI
  configuration that Decision 2 preserves rides on
  `meta.payload`, so the soft reset preserves it for free without
  a parallel storage migration.
- **ADR-0022** IM-06 field-level merge. Precedent for "smoke as
  architectural-correction tool" lessons-learned pattern; the
  soft-reset track should accept smoke findings the same way.

## Implementation trail

Six-step direct-to-main track (no feature branch per the
solo-developer convention recorded 2026-05-04):

| Step | Commit  | Scope                                                 |
| ---- | ------- | ----------------------------------------------------- |
| 1    | accb3e4 | `useSoftReset` hook plus tests (data + storage scope) |
| 2    | 6aaf45d | DE + EN locale strings (`reset:soft.*`, button label) |
| 3    | cdf7d3e | `SoftResetDialog` component plus 13 tests             |
| 4    | dc0aaca | DangerZoneSection two-button stack plus 11 tests      |
| 5    | (this)  | ADR-0023 plus ROADMAP closure entry                   |
| 6    | tbd     | CHANGELOG `[Unreleased]` entry                        |

Test count after Step 4: 41 tests in `src/features/reset/`
(useResetAllData + ResetDialog + SoftResetDialog + DangerZoneSection
combined). `make typecheck` plus `make lint` clean across all four
implementation steps.

## Manual smoke

Manual-smoke plan deferred to a dedicated artefact: see
`docs/manual-smoke/soft-reset.md` (to be authored alongside Step 6
or skipped if no walk is scheduled). Scenario list belongs in the
smoke file per the project's smoke / ADR separation
(execution artefacts vs architectural decisions). If findings
surface during the walk, register them as
`SOFT-RESET-polish-N` ROADMAP markers per the project's polish
convention.
