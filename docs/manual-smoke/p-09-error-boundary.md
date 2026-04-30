# P-09 Error boundary manual smoke

Top-level React error boundary mounted in `src/main.tsx` (P-09).
Vitest covers the component contract (fallback renders, buttons fire,
details collapsed, console.error called). This smoke covers what
automation cannot: real-browser reload semantics (including SW
activation on the new page), copy-paste of the details block from a
real browser, dark-mode contrast, and the no-data-loss promise.

## Setup

1. **Browser**: Chrome with DevTools. Optionally Firefox / Safari for
   secondary verification (the boundary itself is engine-independent;
   reload + SW interaction differs slightly per engine).
2. **Fixture**: an authenticated session with at least one entity per
   type (matches the P-06 setup; reuse the same fixture if walking
   both smokes back-to-back).
3. **Trigger source**: easiest is a hand-edited render-time throw in
   a non-critical component (e.g., `ProfileView` opening line). Add
   `if (true) throw new Error('p-09 smoke trigger');`, save, reload.
   Roll back the edit after the smoke.

## Scenarios

### 1. Boundary catches a render-time error

- **Steps**: Insert the trigger throw into a rendered component.
  Reload the app.
- **Expected**:
  - White / dark-themed card with a warning icon and the heading
    "Etwas ist schiefgelaufen" (DE) or "Something went wrong" (EN).
  - Body paragraph explains the page failed to render and that data
    on disk is intact.
  - Two buttons visible: "Neu laden" and "Zur Startseite".
  - A collapsed `<details>` summary "Technische Details (für
    Fehlerbericht kopieren)".
- **Result**: ☑ pass ☐ fail

### 2. Reload button reloads the page

- **Steps**: Click "Neu laden".
- **Expected**:
  - Page reloads. If the trigger throw is still in the source, the
    boundary catches again (loops on the same fallback). If you have
    rolled the trigger back before clicking, normal app renders.
  - DevTools Network tab shows a fresh page load.
  - Service worker activation: if a new SW is waiting, the reload
    activates it (BUG-01 fix flow). No console error from the SW
    layer.
- **Result**: ☑ pass ☐ fail

### 3. Go-home button navigates to /

- **Steps**: Click "Zur Startseite". (Roll back the trigger throw
  first, otherwise / re-renders the boundary.)
- **Expected**:
  - Browser navigates to `/`. EntryRouter takes over: routes to
    `/welcome` (no vault), `/unlock` (locked), or `/profile`
    (unlocked).
  - Boundary fallback gone; normal app shell renders.
- **Result**: ☑ pass ☐ fail

### 4. Details disclosure copy-paste

- **Steps**: Reproduce the trigger throw. Click the details summary
  to expand. Select the entire technical-details block. Copy.
  Paste into a text editor.
- **Expected**:
  - Pasted text contains the original error message, the stack
    trace, and the React component stack.
  - Line breaks preserved (no flowed-paragraph wrapping).
  - No HTML markup leaked into the clipboard.
- **Result**: ☑ pass ☐ fail

### 5. No-data-loss verification

- **Steps**: Reproduce the trigger throw. Wait on the boundary
  fallback for 30 seconds. Close the browser tab. Reopen Phylax in
  a new tab (with the trigger rolled back). Unlock with your
  password.
- **Expected**:
  - Vault unlocks normally. Profile, observations, lab values etc.
    all present and unchanged.
  - The error path does not corrupt or wipe any IndexedDB data.
- **Result**: ☑ pass ☐ fail

### 6. Dark mode UI

- **Steps**: Toggle theme to dark before triggering. Reload.
- **Expected**: Boundary card legible in dark mode. Heading red-300
  on dark background, body gray-200, buttons readable, details block
  borders visible. No contrast failures.
- **Result**: ☑ pass ☐ fail

### 7. Mobile viewport (360 px)

- **Steps**: Open DevTools Device Mode at 360 px. Reproduce the
  trigger.
- **Expected**:
  - Card max-width clamps to viewport with comfortable padding.
  - Two action buttons fit on one row (or wrap cleanly via
    `flex-wrap`).
  - Details `<pre>` scrolls horizontally inside the card without
    leaking the page scrollbar.
- **Result**: ☑ pass ☐ fail

## Findings

- **B / scenario 4** - Manual select+copy of the technical-details
  block worked but a one-click copy button was missing. Stacktrace
  is the load-bearing artifact for bug reports; faster capture
  matters. Fixed in commit `039576e` (registered as P-09a): added
  copy-icon button at top-right of the expanded disclosure with
  `navigator.clipboard.writeText` + execCommand legacy fallback,
  inline "Kopiert" / "Kopieren fehlgeschlagen" feedback for ~2.5s.

## Sign-off

- ☑ Boundary catches and renders fallback (scenario 1)
- ☑ Reload + Go-home buttons work (scenarios 2 + 3)
- ☑ Details copy-paste preserves diagnostic text (scenario 4)
- ☑ No data loss (scenario 5)
- ☑ Dark mode legible (scenario 6)
- ☑ Mobile 360 px fits (scenario 7)
- ☑ Trigger throw rolled back from source before commit
- ☑ All Category A findings registered as `P-09a..n` ROADMAP sub-tasks (none; P-09a is Category B, fixed inline)

Walker: Asterios Raptis
Date: 2026-04-30
