# P-06 Change master password manual smoke

Security-critical flow that re-encrypts the entire vault under a new
key (ADR-0018). Automated layers (Vitest reencrypt + hook + component
tests, Playwright happy-path E2E) cover wiring + state machine + on-
disk re-encrypt fidelity. This smoke catches what they cannot:
real-browser performance on a populated vault, dark-mode contrast on
the section, the "do not close window" guidance during a slow
operation, and the lock-unlock cycle on actual user-typed passwords.

## Setup

1. **Browser**: Chrome (any modern version). Playwright covers
   chromium; this smoke is for the eye + keyboard fidelity that
   automation skips.
2. **Fixture**: an authenticated session with a non-trivial vault.
   Either:
   - Import a sample profile via `/import` with the standard
     fixture (covers observations, lab data, supplements, open
     points, timeline, profile versions); OR
   - Walk a few rounds of AI-assisted profile creation in `/chat`
     to commit drafts that exercise every entity type; OR
   - Restore a `.phylax` backup that contains real-shape data.
3. **Theme matrix**: scenarios 1-3 are in light mode; scenario 7
   covers dark mode.

## Scenarios

### 1. Happy path: change password, lock, unlock with new password

- **Steps**: Navigate to `/settings`. Scroll to "Master-Passwort
  ändern". Type current password, type new password (≥ 12 chars,
  different from current), type confirmation. Submit. Confirmation
  modal renders; click "Ja, ändern". Wait for the green success
  banner. Click the lock icon in the header. On `/unlock`, type the
  new password; the protected app renders.
- **Expected**:
  - Confirmation modal renders before any work begins.
  - "Daten werden neu verschlüsselt..." status appears for the
    duration of the operation.
  - Form fields disable while operation runs.
  - On done, form clears and a green success banner appears.
  - Lock icon ends the session.
  - New password unlocks; the previous content (observations, lab
    values, etc.) is intact.
- **Result**: ☐ pass ☐ fail

### 2. Old password is rejected after the change

- **Steps**: Continuing from scenario 1 (or after another change),
  lock the app. On `/unlock`, type the OLD password (the one that
  worked before the change).
- **Expected**: "Falsches Passwort" message, no vault access. App
  stays on `/unlock`.
- **Result**: ☐ pass ☐ fail

### 3. Wrong current password: inline error, no progress

- **Steps**: `/settings` → change-password form. Type a wrong
  current password (anything not the actual one). Type valid new
  + confirmation. Submit. Confirm via the modal.
- **Expected**:
  - Inline red alert: "Das aktuelle Master-Passwort ist nicht
    korrekt."
  - No "Daten werden neu verschlüsselt..." status (operation never
    started).
  - Form values preserved so the user can retype just the current
    field.
  - Lock + unlock with the original password still works (vault
    unchanged on disk).
- **Result**: ☐ pass ☐ fail

### 4. Submit-gate validation: weak / mismatch / same-as-current

- **Steps**: Try each of the four invalid input combinations:
  1. Empty new password - submit button disabled.
  2. New password < 12 chars - submit triggers "mindestens X Zeichen".
  3. New + confirm differ - submit triggers "stimmen nicht überein".
  4. New === current - submit triggers "darf nicht mit dem aktuellen
     übereinstimmen".
- **Expected**: Each surfaces an inline alert. None starts the
  re-encryption.
- **Result**: ☐ pass ☐ fail

### 5. Performance on a populated vault

- **Steps**: With a vault holding 50+ entities (observations + lab
  values mostly) and at least one document blob, run scenario 1.
  Time the gap between clicking "Ja, ändern" and the success banner
  appearing.
- **Expected**:
  - Operation completes within roughly 5-15 seconds on a mid-range
    laptop. Slower on phones or with many large document blobs is
    acceptable; the spinner + status copy keeps the user informed.
  - No browser "page unresponsive" warning.
- **Notes**: If the operation takes more than 60 seconds, file a
  P-06-perf-a follow-up task with vault size + browser + machine.
- **Result**: ☐ pass ☐ fail

### 6. Auto-lock does not fire mid-operation

- **Steps**: Set auto-lock to 1 minute (`/settings` → Auto-Lock).
  Keep mouse / keyboard idle. Run scenario 1. Avoid any mouse
  movement or keystrokes after clicking "Ja, ändern".
- **Expected**: The operation completes without auto-lock firing.
  The keyStore singleton is replaced atomically at the end (ADR-0018
  Section 4 pause primitive). Success banner renders; user is still
  unlocked. Auto-lock resumes after the operation, so the timer
  starts fresh.
- **Result**: ☐ pass ☐ fail

### 7. Dark mode UI

- **Steps**: Toggle theme to dark. Walk scenario 1 + scenario 3 in
  dark. Verify form fields, alerts (success green and error red),
  and the confirmation modal all read with sufficient contrast.
- **Expected**: All states legible. No invisible borders or text
  that disappears against the dark background.
- **Result**: ☐ pass ☐ fail

### 8. Close-window guidance during operation

- **Steps**: Start scenario 1 with a populated vault (so the
  operation runs for at least a few seconds). Read the description
  copy in the section header before submitting.
- **Expected**: The DE description copy says "Schließe das Fenster
  während des Vorgangs nicht." (and the EN equivalent). The user is
  warned before submitting.
- **Result**: ☐ pass ☐ fail

## Findings

User adds findings here. Severity tag (A / B / C) + scenario number.

- (none yet)

## Sign-off

Tick each criterion when its scenarios pass.

- ☐ Happy path complete (scenarios 1 + 2)
- ☐ Validation gates exercised (scenarios 3 + 4)
- ☐ Performance acceptable on a populated vault (scenario 5)
- ☐ Auto-lock pause holds (scenario 6)
- ☐ Dark mode verified (scenario 7)
- ☐ Close-window guidance visible (scenario 8)
- ☐ All Category A findings registered as `P-06a..n` ROADMAP sub-tasks

Walker: ____________________
Date: 2026-__-__
