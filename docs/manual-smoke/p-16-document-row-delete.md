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
- **Result**: ☐ pass ☐ fail

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
- **Result**: ☐ pass ☐ fail

### 3. Confirm deletes and the row vanishes

- **Steps**: Open the confirmation. Click "Löschen bestätigen".
- **Expected**:
  - Dialog closes.
  - The deleted row disappears from the list immediately (via
    `onDeleted` -> refreshKey bump -> refetch).
  - Other rows unaffected.
  - Storage indicator below the list updates with the new used-bytes
    figure.
- **Result**: ☐ pass ☐ fail

### 4. Linked-document cascade warning

- **Steps**: Click delete on a document that is linked to an
  observation (D-07). Observe the dialog.
- **Expected**:
  - Body shows the cascade-warning copy "Dokument ist verknüpft mit
    Beobachtung. Verknüpfung wird entfernt."
  - Confirming still deletes the document; the linked observation
    survives, only the link reference is cleared.
- **Result**: ☐ pass ☐ fail

### 5. 360 px viewport fit

- **Steps**: Open DevTools Device Mode at 360 px. Walk scenarios 1
  and 3.
- **Expected**:
  - Each row's link area + trash icon both fit within the row.
  - Filename truncates with ellipsis if too long; trash icon stays
    visible to the right.
  - Modal at 360 px clamps to viewport via `max-w` (Modal primitive
    behaviour); buttons fit in the footer.
- **Result**: ☐ pass ☐ fail

### 6. Dark mode

- **Steps**: Toggle theme to dark. Repeat scenarios 1 and 2.
- **Expected**:
  - Trash icon stays legible on dark hover background
    (`dark:hover:bg-red-900/30`).
  - Modal text + buttons stay legible.
- **Result**: ☐ pass ☐ fail

### 7. Cancel preserves the document

- **Steps**: Click the trash icon. Click "Abbrechen". Reload the
  page or navigate away and back.
- **Expected**:
  - Document still in the list.
  - On-disk vault unchanged.
- **Result**: ☐ pass ☐ fail

## Findings

- (none yet)

## Sign-off

- ☐ Inline trigger renders + hit target acceptable (scenario 1)
- ☐ Confirmation dialog opens with destructive chrome (scenario 2)
- ☐ Confirm deletes + list refreshes (scenario 3)
- ☐ Cascade warning surfaces on linked documents (scenario 4)
- ☐ 360 px fit (scenario 5)
- ☐ Dark mode legible (scenario 6)
- ☐ Cancel preserves the document (scenario 7)

Walker: ____________________
Date: 2026-__-__
