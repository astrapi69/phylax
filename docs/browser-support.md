# Browser Support and Known Caveats

Runtime behavior observed on supported browsers beyond the baseline
stated in `.claude/rules/quality-checks.md`. Short, observational.
Revisit per item when real user feedback surfaces.

## Baseline

Latest Chrome, Firefox, Edge, desktop Safari (last two versions each);
iOS Safari 16+; Chrome on Android 12+. No IE, no legacy Edge.

## PDF viewer (D-05)

Phylax renders uploaded PDFs by creating a `blob:` URL from the
decrypted bytes and mounting it as the `src` of a native `<iframe>`
with `sandbox="allow-scripts"` (see security note below).
The browser decides how to render the blob.

- **Chrome, Firefox, Edge, desktop Safari:** inline PDF rendering with
  the browser's built-in viewer (page navigation, zoom, print, text
  selection). Works out of the box.
- **iOS Safari (all supported versions):** renders only the first
  page inline, with an "open" affordance to hand the PDF off to a
  native viewer. This is degraded but functional: users can read the
  full document in iOS Quick Look.
- **Chrome on Android:** inline rendering is available when the
  device has a PDF handler installed; otherwise the browser offers
  a download fallback.

Accepted behavior. We do not bundle `pdf.js` (~150 KB gzip core,
~350 KB gzip for the full viewer) for parity. If iOS Safari inline
rendering becomes a blocker for real users, revisit with an ADR.

### Sandbox policy

The PDF iframe uses `sandbox="allow-scripts"`.

- `allow-scripts` is required because Chromium's pdfium viewer and
  Firefox's pdf.js viewer are both JavaScript-driven content
  handlers. Without it, the PDF would not render at all. (HTML
  sandbox behavior was verified empirically in both engines during
  D-05 implementation; PDF-specific rendering cannot be verified in
  Playwright headless because headless browsers do not ship a PDF
  viewer, so the conclusion rests on the known mechanism plus
  confirmation that the sandbox + blob URL infrastructure works for
  HTML content under the same flags.)
- `allow-same-origin` is deliberately **not** granted. Omitting it
  means the iframe's effective origin is opaque (null): any
  JavaScript inside the PDF (e.g. embedded form logic, or a
  malicious PDF uploaded by a user) runs in an origin that cannot
  read the Phylax origin's IndexedDB, localStorage, or in-memory
  state. This mitigates the "malicious PDF exfiltrates encrypted
  health data" threat at negligible cost to normal PDFs, which do
  not rely on parent-origin access to render.
- Trade-off: PDFs whose form logic makes same-origin requests (rare
  in medical documents) will have degraded form behavior. Accepted.

## Image viewer (D-06)

Images are rendered in a native `<img>` element with zoom controlled
by React state and `width`/`height` attributes (no CSS transforms,
so native scrollbars provide pan automatically).

- Whitelisted MIME types: `image/png`, `image/jpeg`, `image/webp`.
  `image/svg+xml` is deliberately excluded because SVG can carry
  script; it would bypass the Phylax sandboxing model. Enforced at
  both the upload layer and the viewer dispatcher.
- Zoom: +/- buttons, reset ("Fit") button, Ctrl+wheel, and keyboard
  shortcuts (`+`, `-`, `0`). Range 25% to 500% of natural size.
- Pan: via the container's `overflow: auto` scrollbars. Works with
  mouse drag on scrollbars, touch swipe, and keyboard arrow keys.
- Mobile pinch zoom is deferred to a future polish task. Mobile
  users get the zoom buttons plus native scrollbar pan, which is
  functional if less fluid.

## IndexedDB eviction

iOS Safari clears IndexedDB after 7 days of site inactivity unless
the app is added to the home screen. Onboarding documents this.
`navigator.storage.persist()` is requested on first unlock
(D-10 will make this explicit).
