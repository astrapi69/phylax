# AI Multi-Provider manual smoke

Five-commit Multi-AI-Provider series shipped 2026-05-01: foundation
(`ef49c65`), storage + migration (`bc3c24b`), wizard (`3df95f6`),
aiCall + streaming refactor (`c58129b`), AISettingsSection +
lazy mount (`be4d312`), ADR + smoke (this commit). Vitest covers
adapters, presets, verifyKey, storage migration, reencryption,
wizard step machine, AISettingsSection summary, lazy boundary,
streaming behaviour preservation in useChat + requestCleanup. This
smoke covers what automation cannot:

- Real Anthropic / Google / OpenAI streaming via `aiCall` against
  live endpoints
- Network interruption mid-stream behaviour in a real browser
- Existing-Anthropic-user backwards-compat surface
- Master-password change preservation of multi-provider config
- Wizard 3-step flow real-browser feel (focus, tab order,
  scroll lock, theme contrast, 360 px fit)
- Lazy-load chunk timing (network tab confirms wizard chunk
  arrives only after click)

## Setup

1. **Browser**: Chrome with DevTools.
2. **Fixture**: authenticated session with at least one profile.
   For backwards-compat scenarios (4-5), seed a vault that already
   carries an Anthropic single-shape config (any vault from before
   2026-05-01 works without action; new vaults can simulate by
   running scenario 9 first).
3. **API keys**: real Anthropic key required for scenarios 1, 4,
   5, 7, 10. Real Google Gemini key for scenario 2. Optional
   OpenAI key for scenario 8 (CORS-blocked, expected failure).
4. **Theme matrix**: scenarios 1-3 in light, scenario 14 in dark.

## Scenarios

### 1. Real Anthropic streaming via aiCall (chat feature)

- **Steps**: Configure Anthropic via wizard. Open `/chat`. Send
  a message ("Was sind häufige Ursachen für Schulterschmerzen?").
- **Expected**:
  - Tokens stream in real-time, no batching delay.
  - `onComplete` fires once the model produces a complete
    response.
  - `errorMessageFor` translation (German UI) absent (no error).
  - Chrome Network tab shows a single SSE request to
    `https://api.anthropic.com/v1/messages`.
- **Result**: ☐ pass ☐ fail

### 2. Real Google streaming via aiCall

- **Steps**: Configure Google via wizard (Gemini OpenAI-compat
  endpoint). Open `/chat`. Send the same message as scenario 1.
- **Expected**:
  - Tokens stream in real-time from Google's endpoint.
  - Network tab shows the request to
    `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`.
  - No CORS-blocked failure (Google's OpenAI-compat endpoint
    allows browser CORS).
  - Response quality differs from Anthropic but the streaming
    UX is identical.
- **Result**: ☐ pass ☐ fail

### 3. CORS-blocked OpenAI (configure + verify-fail UX)

- **Steps**: In the wizard, pick OpenAI. Step 2 surfaces the
  amber CORS warning above the API-key field. Enter a (real or
  fake) key. Step 3 click "Verbindung testen".
- **Expected**:
  - Warning text reads "Hinweis: Dieser Anbieter blockiert
    direkte Browser-Anfragen. ..."
  - Test connection fails cleanly. Status maps to `'offline'` or
    `'auth_error'` depending on whether the browser's preflight
    rejected the request before reaching OpenAI's server.
  - Save still works (button enabled). Later real chat calls
    fail; user sees `errorMessageFor` German message.
- **Result**: ☐ pass ☐ fail

### 4. Network interruption mid-stream (silent abort)

- **Steps**: Configure Anthropic. Open `/chat`. Send a message
  long enough to take a few seconds to stream. While streaming,
  open Chrome DevTools Network tab and toggle "Offline".
- **Expected**:
  - Stream halts.
  - No error toast / no error system-message appended (silent
    abort contract).
  - Toggle Offline back to "No throttling": next sendMessage
    works without app reload.
- **Result**: ☐ pass ☐ fail

### 5. requestCleanup AI-fallback flow with real Anthropic

- **Steps**: Configure Anthropic. Go to `/import`. Paste broken
  markdown that the parser cannot recognise. Click the
  "KI-Hilfe anfordern" button on the parse-failure screen.
- **Expected**:
  - Cleanup request fires through aiStream (network tab shows
    Anthropic SSE).
  - On success: parser re-runs, lands on profile-selection.
  - On Anthropic refusal ("NICHT_VERARBEITBAR"): impossible
    state surfaces, user sees the appropriate copy.
  - On network failure: error state with `ChatError` rendered.
- **Result**: ☐ pass ☐ fail

### 6. Wizard 3-step flow (provider select / key+model / test)

- **Steps**: Open Settings, click "KI aktivieren". Step through
  the disclaimer (first time) or skip directly to wizard.
  Step 0: pick Google. Step 1: paste a real Gemini key. Step 2:
  click "Verbindung testen".
- **Expected**:
  - Step dot indicator advances correctly.
  - Step 1 baseUrl + model fields auto-fill from the Google
    preset (`https://generativelanguage.googleapis.com/...`,
    `gemini-2.0-flash`). API-key field empty.
  - Test button green-checks on success.
  - Finish button enables only after a non-empty key (cloud
    provider) or always (local provider).
- **Result**: ☐ pass ☐ fail

### 7. Multi-provider switch (configure 2 + switch active)

- **Steps**: Configure Anthropic (becomes active). Open Settings,
  click "Anbieter verwalten". Wizard opens pre-filled with
  Anthropic. Switch radio to Google. Enter Google key. Finish.
- **Expected**:
  - After save, summary card shows "Google (Gemini)" as active
    provider.
  - Anthropic entry stays in the multi-provider list (verifiable
    by switching back via "Anbieter verwalten" → Anthropic
    radio: the previous Anthropic key is pre-filled, not lost).
  - `/chat` now talks to Google.
- **Result**: ☐ pass ☐ fail

### 8. CORS-blocked provider warning UX (OpenAI deep dive)

- **Steps**: Wizard → OpenAI. Step 2 amber warning visible.
  Save anyway. Open `/chat`. Send a message.
- **Expected**:
  - Wizard saves without preventing the user.
  - Chat request fails with a German error string explaining
    the network error.
  - Browser DevTools console / network tab shows the CORS
    rejection (preflight blocked).
  - User can recover via Settings → Anbieter verwalten →
    switch back to Anthropic.
- **Result**: ☐ pass ☐ fail

### 9. Backwards-compat: existing single-shape Anthropic user

- **Steps**: Use a vault that pre-dates 2026-05-01 (or
  manually-crafted single-shape `aiConfig` in `meta.payload`).
  Open Settings.
- **Expected**:
  - AISettingsSection summary card shows "Anthropic (Claude)"
    - masked key + model.
  - "Anbieter verwalten" opens the wizard pre-filled with the
    saved Anthropic provider radio + key + model.
  - No forced wizard / no migration prompt; the user sees no
    interruption to their existing flow.
  - `/chat` works under the new aiCall path with the same UX.
- **Result**: ☐ pass ☐ fail

### 10. Master-password change preserves multi-AI config (P-06)

- **Steps**: Configure 2 providers via the wizard
  (Anthropic + Google). Change master password via
  Settings → Master-Passwort ändern. Reload, unlock with the
  new password.
- **Expected**:
  - Both Anthropic + Google entries survive intact.
  - Active provider unchanged.
  - `/chat` works without re-entering keys.
  - Old password fails to unlock (P-06 contract).
- **Result**: ☐ pass ☐ fail

### 11. Disclaimer flow: first-time activation

- **Steps**: Fresh vault, never accepted disclaimer. Open
  Settings, click "KI aktivieren".
- **Expected**:
  - AIDisclaimer modal opens BEFORE the wizard.
  - On "Verstanden, KI aktivieren": disclaimer closes, wizard
    opens, localStorage flag set to "true".
  - On "Abbrechen": disclaimer closes, wizard does NOT open,
    flag NOT set.
- **Result**: ☐ pass ☐ fail

### 12. Already-accepted disclaimer skips straight to wizard

- **Steps**: After scenario 11 confirm, disable + re-enable AI
  (or close + reopen the wizard). Click "KI aktivieren".
- **Expected**:
  - No disclaimer re-prompt (one-shot per vault).
  - Wizard opens directly.
- **Result**: ☐ pass ☐ fail

### 13. KI deaktivieren clears multi config

- **Steps**: Configure 2 providers. Click "KI deaktivieren".
- **Expected**:
  - Confirmation handled by the underlying `deleteConfig` (no
    extra modal in 4b; deletion is immediate per legacy
    behaviour).
  - Section returns to unconfigured view ("Nicht aktiv" + "KI
    aktivieren").
  - `readMultiAIConfig()` would now return `null` (verifiable
    via DevTools or by reopening the wizard: it shows fresh
    defaults, not the previously-saved entries).
- **Result**: ☐ pass ☐ fail

### 14. Light + dark mode UI

- **Steps**: Walk scenarios 6 and 9 in light mode. Toggle to
  dark. Re-walk 6 and 9.
- **Expected**:
  - Wizard chrome contrast acceptable (radios, step dots,
    test-button states).
  - CORS warning amber legible in dark.
  - Summary card border + background distinguishable in dark.
- **Result**: ☐ pass ☐ fail

### 15. 360 px viewport fit

- **Steps**: DevTools Device Mode at 360 px. Open the wizard.
  Walk through all 3 steps.
- **Expected**:
  - Modal clamps via `max-w-md`.
  - Provider radio grid wraps cleanly (2 columns on this
    viewport).
  - API-key input + show/hide toggle button fit on one line or
    wrap without overflow.
  - Footer Cancel + Back + Next/Finish buttons visible without
    horizontal scroll.
  - AISettingsSection summary card readable; provider label +
    masked key + model wrap if long but no overflow.
- **Result**: ☐ pass ☐ fail

### 16. Lazy wizard load timing

- **Steps**: Open DevTools Network tab. Filter to JS. Reload
  Settings page. Note the JS chunks that load on page render.
  Click "KI aktivieren" / "Anbieter verwalten". Note the new
  chunk that arrives after the click.
- **Expected**:
  - Settings page renders without the wizard chunk in the
    initial JS bundle.
  - Click triggers a single chunk fetch (the dynamic
    `import('../ai/AiSetupWizard')`).
  - On second click in the same session: no fetch (chunk
    cached).
  - Estimated chunk size: ~6-8 KB gzipped per Commit 1's bundle
    estimate.
- **Result**: ☐ pass ☐ fail

## Findings

(none yet)

## Sign-off

- ☐ Real Anthropic streaming via aiCall (scenario 1)
- ☐ Real Google streaming via aiCall (scenario 2)
- ☐ CORS-blocked OpenAI configure + verify-fail UX (scenario 3)
- ☐ Network interruption mid-stream silent abort (scenario 4)
- ☐ requestCleanup AI-fallback with real API (scenario 5)
- ☐ Wizard 3-step flow (scenario 6)
- ☐ Multi-provider switch via wizard (scenario 7)
- ☐ CORS-blocked provider warning UX deep dive (scenario 8)
- ☐ Backwards-compat single-shape Anthropic user (scenario 9)
- ☐ Master-password change preserves multi-AI config (scenario 10)
- ☐ Disclaimer flow first-time activation (scenario 11)
- ☐ Already-accepted disclaimer skips straight to wizard (scenario 12)
- ☐ KI deaktivieren clears multi config (scenario 13)
- ☐ Light + dark mode (scenario 14)
- ☐ 360 px fit (scenario 15)
- ☐ Lazy wizard load timing (scenario 16)

Walker: ********\_\_\_\_********
Date: 2026-**-**
