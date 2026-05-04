# D-03: PWABuilder packaging workflow

How to turn the deployed Phylax PWA into installable Play Store
and Microsoft Store packages via [PWABuilder](https://www.pwabuilder.com/).

This file is the **maintainer-side runbook**. The repo-side prep
(manifest fields, icon set, service-worker config, deployed URL) is
already in place; the packaging upload + store submission is a
manual workflow that has to happen in a browser.

## Prereqs (already shipped)

- D-01 deploys the production build to https://astrapi69.github.io/phylax/.
- Manifest carries the PWABuilder-quality fields: `id`,
  `display_override`, `launch_handler`, `categories`, full icon set
  including 192 / 512 maskable variants, theme + background colors,
  scope + start_url. See [`vite.config.ts`](../vite.config.ts).
- Service worker shipped via vite-plugin-pwa with Workbox precache
  (silent-update model, BUG-01).

## Open prereq before submission

- **Screenshots.** PWABuilder Quality flags missing `screenshots[]`
  with a high severity for store submission. Capture three to five
  screenshots from the live URL on a real device or
  Chrome DevTools' device-mode (mobile-viewport-768x1024 default
  works), save them to `public/screenshots/<name>.png`, and add a
  `screenshots` array to the manifest in
  [`vite.config.ts`](../vite.config.ts) before running PWABuilder.
  This step is deliberately deferred until real captures exist;
  placeholder screenshots are worse than none for store review.
- **(Optional) shortcut entries.** Every entry needs an icon; defer
  unless / until concrete shortcut targets are picked.

## Workflow

### 1. PWABuilder report card

1. Open https://www.pwabuilder.com/.
2. Paste `https://astrapi69.github.io/phylax/` and submit.
3. PWABuilder runs an analyzer pass. Resolve every red item before
   continuing; the warnings (mostly screenshots) are advisory but
   the stores tend to enforce them.

### 2. Generate the packages

Two formats are relevant for Phylax:

#### Microsoft Store (.msixbundle)

1. From the report card, click **Package for Stores**.
2. Pick the Windows / Microsoft Store path.
3. Use these values:
   - Publisher display name: `Asterios Raptis`
   - Publisher ID: copy verbatim from the existing Partner Center
     account, format `CN=...` (PWABuilder will tell you to register
     a Microsoft Partner Center account if missing).
   - Package identity name: `phylax`
   - App version: match `package.json` (currently
     [`pkg.version`](../package.json) = `1.1.0`).
4. Download the `.msixbundle`. Test-install locally before
   submission via `Add-AppxPackage` in PowerShell.

#### Google Play (.aab via TWA / Bubblewrap)

1. From the report card, click **Package for Stores** again.
2. Pick the Android / Google Play path. PWABuilder generates a
   Trusted Web Activity (TWA) bundle.
3. Provide:
   - Application ID: `com.asterios.phylax` (reverse-domain
     convention).
   - Display name: `Phylax`.
   - Host: `astrapi69.github.io`.
   - Start URL: `/phylax/`.
   - App version code + name: bump on every store submission
     (codes are integers; align name with `pkg.version`).
4. Download both the signed `.aab` and the **Digital Asset
   Links** JSON. The DAL JSON has to be served at
   `https://astrapi69.github.io/.well-known/assetlinks.json`
   so Android can verify domain ownership; place it in the
   `astrapi69.github.io` repository (the user / org pages site),
   NOT in this repo, because the path lives at the apex domain.

### 3. Submit

- **Microsoft Store**: Partner Center -> create new app -> upload
  the `.msixbundle` -> wait for review (typically 24-72 h).
- **Google Play Console**: create new app -> internal testing
  track -> upload the `.aab` -> verify the asset-links file is
  reachable -> promote to production.

Both stores expect:

- App icon (use the maskable 512 variant).
- Feature graphic (Play Store) - generate from the icon SVG.
- Description (short + long) - lift from the deployed README +
  manifest description.
- Privacy policy URL - point at
  https://astrapi69.github.io/phylax-docs/privacy or the German
  equivalent.

### 4. Post-submission

- Track approval status. Any rejection feedback usually maps to a
  manifest gap; resolve in [`vite.config.ts`](../vite.config.ts),
  re-package, re-submit.
- Bump `package.json` version on every store re-submission so the
  store has a unique version code.
- If the deployed URL changes (D-02 custom domain), regenerate
  both packages: TWA's host binding and MSIX's identity binding
  both reference the URL.

## Why this is not automated

The PWABuilder web flow needs human judgement:

- Screenshots have to look right; they cannot be programmatically
  validated.
- Store-account credentials are not in the repo and cannot be in
  CI.
- Submission decisions (track, rollout %) are policy-side, not
  code-side.

A future "publish PWA packages" GitHub Action would need a real
Microsoft Partner Center service principal and a Google Play
service account; both are out of scope for the local-first
single-vault architecture and would re-introduce the
"external-service surface" that
[`.claude/rules/architecture.md`](../.claude/rules/architecture.md)
calls out as a non-goal.

## References

- D-01: GitHub Pages deployment that produced the live URL.
- ADR-0010 / 0012 / 0013 / 0015: bundle-size budgets enforced
  before any package is generated.
- BUG-01: silent-update SW config that the packaging inherits.
