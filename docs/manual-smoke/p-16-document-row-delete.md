# P-16 Inline document-list delete manual smoke

Inline list-row delete affordance for `/documents` (P-16). Vitest
covers: trigger button + aria-label, dialog opens, cancel, confirm
deletes + fires onDeleted, linked-warning. This smoke covers what
automation cannot: real layout fit at 360 px, focus-trap behaviour
in a real browser, dark-mode contrast, and the side-effect that
the row vanishes after a successful delete.

## Setup

1. **Browser**: Chrome with DevTools.
2. **Fixture**: authenticated session with at least three documents in
   the list. Mix of types: one PDF, one image, one document linked to
   an observation (via D-07).
3. **Theme matrix**: scenarios 1-3 in light, scenario 6 in dark.

## Scenarios

### 1. Inline trigger button is visible per row

- **Steps**: Navigate to `/documents`. Inspect each row.
- **Expected**:
  - Each row has a trash-icon button on the right side, aligned to
    the row baseline.
  - Hit target is 44 x 44 px.
  - Hovering the button shows the destructive (red-tinted) hover
    state without affecting the navigation link's hover.
- **Result**: ☑ pass ☐ fail

### 2. Click opens the destructive confirmation dialog

- **Steps**: Click the trash icon on any row.
- **Expected**:
  - Modal opens with title "Dokument löschen", body "{filename}
    dauerhaft löschen? Kann nicht rückgängig gemacht werden.", red
    confirm button "Löschen bestätigen".
  - Focus traps inside the modal.
  - Cancel button focused on mount (destructive-modal default).
  - Backdrop click does NOT close (matches D-08 destructive policy).
  - Escape closes the modal cleanly.
- **Result**: ☑ pass ☐ fail

### 3. Confirm deletes and the row vanishes

- **Steps**: Open the confirmation. Click "Löschen bestätigen".
- **Expected**:
  - Dialog closes.
  - The deleted row disappears from the list immediately (via
    `onDeleted` -> refreshKey bump -> refetch).
  - Other rows unaffected.
  - Storage indicator below the list updates with the new used-bytes
    figure.
- **Result**: ☑ pass ☐ fail

### 4. Linked-document cascade warning

- **Steps**: Click delete on a document that is linked to an
  observation (D-07). Observe the dialog.
- **Expected**:
  - Body shows the cascade-warning copy "Dokument ist verknüpft mit
    Beobachtung. Verknüpfung wird entfernt."
  - Confirming still deletes the document; the linked observation
    survives, only the link reference is cleared.
- **Result**: ☑ pass ☐ fail

### 5. 360 px viewport fit

- **Steps**: Open DevTools Device Mode at 360 px. Walk scenarios 1
  and 3.
- **Expected**:
  - Each row's link area + trash icon both fit within the row.
  - Filename truncates with ellipsis if too long; trash icon stays
    visible to the right.
  - Modal at 360 px clamps to viewport via `max-w` (Modal primitive
    behaviour); buttons fit in the footer.
- **Result**: ☑ pass ☐ fail

### 6. Dark mode

- **Steps**: Toggle theme to dark. Repeat scenarios 1 and 2.
- **Expected**:
  - Trash icon stays legible on dark hover background
    (`dark:hover:bg-red-900/30`).
  - Modal text + buttons stay legible.
- **Result**: ☑ pass ☐ fail

### 7. Cancel preserves the document

- **Steps**: Click the trash icon. Click "Abbrechen". Reload the
  page or navigate away and back.
- **Expected**:
  - Document still in the list.
  - On-disk vault unchanged.
- **Result**: ☑ pass ☐ fail

## Findings

The P-16 walk surfaced four bugs touching the broader documents
surface (not P-16-introduced). All four were fixed inline before
sign-off:

- **B / scenario 2** - PDF preview was blocked by Chromium with
  "Diese Seite wurde von Chrome blockiert" / "Not allowed to load
  local resource: blob:...". Three-step fix:
  1. Sandbox attribute change (`allow-scripts` -> `allow-scripts
     allow-same-origin`) in commit `7a204d0`.
  2. Workbox `navigateFallbackDenylist: [/^blob:/]` so the SW
     stops intercepting blob URL navigations and returning the
     SPA shell, in commit `0975739`.
  3. Switch from `<iframe sandbox>` to `<object data
     type="application/pdf">` so Chromium's PDF plugin handles the
     blob URL natively, in commit `9480597`. Registered as BUG-03.

- **B / between scenarios** - Upload-success banner never vanished
  after delete; the green "{{filename}} wurde gespeichert" line
  stayed referencing a now-deleted document. Auto-dismiss after 5s
  + manual ✕ close button added in commit `0ec42b3`. Registered as
  BUG-04.

- **A / scenario 3** - After a successful upload the new row did
  NOT appear in the list until the user navigated away and back.
  Stale-closure bug in `DocumentUploadButton.handleChange`: the
  awaited upload completed but the post-await read of
  `upload.status.kind` referenced the captured render-time closure
  (still `idle`), so `onUploaded` never fired and the parent's
  `refreshKey` bump never ran. Hook `upload()` now returns the
  resolved status; consumer reads return value. Fixed in commit
  `e5a6b35`. Registered as BUG-05.

- **B / mobile drawer (cross-cut)** - Tapping the top-left of the
  open mobile drawer (where the Header's hamburger sits) felt like
  the natural close gesture but the only close affordances were the
  X button on the right and the backdrop. Added a hamburger button
  at the top-left mirroring the Header's open-position; subsequent
  follow-up dropped the redundant right-side X. Fixed in commits
  `d351b7b` + `6931afa`. Registered as BUG-06.

After all four fixes, all 7 P-16 scenarios verified pass on the
populated vault.

## Sign-off

- ☑ Inline trigger renders + hit target acceptable (scenario 1)
- ☑ Confirmation dialog opens with destructive chrome (scenario 2)
- ☑ Confirm deletes + list refreshes (scenario 3)
- ☑ Cascade warning surfaces on linked documents (scenario 4)
- ☑ 360 px fit (scenario 5)
- ☑ Dark mode legible (scenario 6)
- ☑ Cancel preserves the document (scenario 7)

Walker: Asterios Raptis
Date: 2026-04-30
