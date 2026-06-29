# Phylax Roadmap

Aktiver Plan ab v1.1.0 (2026-05-02). Alle bis dahin abgeschlossenen
Tasks liegen archiviert in
[`docs/roadmap-history/2026-05-02-v1.1.0.md`](roadmap-history/2026-05-02-v1.1.0.md);
die freigegebenen Releases stehen in [`../CHANGELOG.md`](../CHANGELOG.md).

Diese Datei listet ausschliesslich offene Arbeit. Erledigte Tasks
landen direkt im CHANGELOG `[Unreleased]`-Block per
`.claude/rules/release-workflow.md`. Beim naechsten Release
(SemVer-Bump) wird der `[Unreleased]`-Block in eine versionierte
Section umgewandelt; diese ROADMAP behaelt nur die offenen Punkte.

## Phase 7: Polish (in progress)

- [ ] **P-01** Mobile-first responsive review of every screen at 360
      px / 768 px / 1024 px. Tier 1 automated viewport sweep is green.
      Tier 2 manual walk-through is the canonical artefact at
      [`docs/manual-smoke/p-01-mobile-sweep.md`](manual-smoke/p-01-mobile-sweep.md);
      sign-off pending. Findings register as P-01a..n and ship as
      separate per-finding commits per Q3 lock.
- [ ] **P-07-d** A11y screen-reader sweep across NVDA / VoiceOver /
      Orca / TalkBack. Deferred from the 2026-04-29 manual sweep
      because no SR was installed at the time. Archive findings as
      P-07-d-a..n.
- [ ] **P-11** Translations: ES, FR, EL. **Postponed** until the
      bug-clean state plus a per-language scope spec lands (Spanish
      dialect, French regional variant, Greek-specific medical
      terminology all undecided).
- [ ] **P-13** Image viewer: GPU-accelerated `transform: scale()`
      zoom plus explicitly sized overflow wrapper if large-image
      (~20 MB medical scan) zoom CPU cost becomes noticeable. Marker
      only. **Revisit when:** a user reports zoom-jank on a real scan
      or a perf audit shows >100 ms scripting cost per zoom step.
- [ ] **P-14** Image viewer: pinch-to-zoom on touch devices.
      D-06 ships mobile with zoom buttons + native scrollbar pan.
      Marker only. **Revisit when:** a manual smoke or user report
      flags pinch-zoom missing on mobile, or the touch-device
      userbase grows beyond the single-user-on-laptop scope.
- [ ] **P-15** Document link picker: evaluate a searchable combobox
      when observation / lab-value counts per profile exceed ~30.
      D-07 ships a native `<select>` which is keyboard-accessible and
      zero-bundle but becomes scroll-heavy at larger counts.
      **Revisit when:** any profile crosses ~30 themes / observations
      / lab values that surface in the link picker.

## AI Provider polish (AIP-series)

- [ ] **AIP-polish-2** Generic structured-output abstraction.
      **Trigger:** a second provider needs tool calling (OpenAI
      function calling or Google function declarations). Current
      `requestCompletion` Anthropic-only path stays until then.
- [ ] **AIP-polish-3** Proxy-server infrastructure for CORS-blocked
      providers (OpenAI, Mistral). Both providers save in the wizard
      with a warning today but live calls fail at the browser CORS
      preflight. Out-of-scope for the local-first single-vault
      architecture; revisit if a real-world deployment scenario
      demands it.

## Phase 7 follow-up: Build tooling

- [x] **VITE 8 UPGRADE**: Migrate from Vite 7.3.2 to Vite 8.0.x with
      the Rolldown-based bundler. vite-plugin-pwa bumped to 1.3.0 for
      Vite 8 peer-dep coverage. plugin-react and vitest unchanged
      (already Vite-8-compatible). vite.config.ts unchanged: no
      rollupOptions, manualChunks, or esbuild.\* surface required
      migration. Size-limit budgets adjusted: jsPDF chunk 140 KB ->
      145 KB for routine variance headroom; workbox pattern widened
      to cover both assets-subdir and dist-root workbox-\*.js with
      20 KB budget after pre-existing pattern gap closed. (Shipped
      2026-05-07 in commits 61dd1da (deps bump), a476447 (size-limit
      fixes), plus this commit (ROADMAP + CHANGELOG). V8-track.
      Manual smoke deferred to V8-05.)

## Phase 7 follow-up: Settings polish

- [x] **SOFT-RESET** Soft-reset (data wipe with master-password
      preservation). **Shipped 2026-05-06 in commits accb3e4
      (useSoftReset hook), 6aaf45d (DE + EN locale strings), cdf7d3e
      (SoftResetDialog component), dc0aaca (DangerZoneSection
      two-button stack), plus this commit (ADR-0023).** Six-step
      direct-to-main track: hook -> locales -> dialog ->
      DangerZoneSection -> ADR-0023 -> CHANGELOG. AI configuration,
      master password, in-memory crypto key, and user preferences
      preserved across the wipe; only the ten profile-data tables
      and `phylax.persistence.*` localStorage keys are cleared.
      Locale-aware type-challenge (DE `LOESCHEN` / EN `CLEAR`).
      Two-button stack in the danger zone (amber soft above red
      hard). Post-reset navigation via React Router
      `navigate('/profile/create', { replace: true })` to preserve
      the in-memory key. Hard-reset path unchanged. No polish
      markers registered. Architectural decisions:
      [ADR-0023](decisions/ADR-0023-soft-reset.md).

## Phase 4 follow-up: Import

- [x] **IM-06** Field-level merge mode. **Shipped 2026-05-04 in
      merge commit 69f5ff3.** 12 commits across 8 implementation
      steps + smoke-walk fixes. 384 unit tests + 11 e2e tests
      passing (2854 total project-wide). Manual smoke scenarios
      1, 2, 2b verified during the walk; scenarios 3-20 deferred
      and accepted as technical debt - findings will surface as
      ROADMAP polish markers if real-user reports come in.
      Architectural decisions:
      [ADR-0022](decisions/ADR-0022-im-06-field-level-merge.md).
      Spec: [`specs/IM-06-field-level-merge.md`](specs/IM-06-field-level-merge.md).

- [ ] **IM-06-polish-1** Synth-marker dedup. Multiple successive
      merge-imports accumulate one synthesized "Profil aus Datei
      importiert" `ProfileVersion` row per import. By design
      (audit trail of import gestures). If real users report
      `ProfileVersion` clutter, dedup adjacent identical synth
      markers (same `changeDate` + `changeDescription`) at write
      time. Trigger: user feedback flagging clutter. Not blocking
      IM-06 ship.

- [ ] **IM-06-polish-2** `submitResolutions` silent no-op outside
      `'conflict-resolution'` state. The state-machine method
      currently returns silently when called in any other state,
      matching the rest of `useImport`'s defensive style. Could
      be elevated to a dev-time warning (or thrown error) for
      better debuggability if the silent case starts hiding UI
      bugs. Trigger: a programmer-error report or smoke-walk
      finding. Not blocking IM-06 ship.

- [ ] **IM-06-polish-3** Value-preview in mine/theirs picks. The
      Step 5a dialog renders only the differing field-name list
      for mine/theirs picks; the user must switch to
      field-by-field to see actual values. Step 5b's field-by-field
      expansion likely resolves this for users who care about
      values. Trigger: smoke walk surfacing user frustration with
      blind picks. If confirmed unnecessary, drop the marker
      after Step 7 smoke pass. Not blocking IM-06 ship.

- [ ] **IM-06-polish-5** Radio click-target verification. Playwright
      e2e tests in `tests/e2e/im-06-merge.spec.ts` use `force: true`
      on ConfirmDialog + ConflictResolutionDialog radio clicks to
      bypass click-actionability checks under automated test
      timing. The full IM-06 manual smoke walk (which clicks
      without `force`) verifies whether real-user clicks land
      reliably or whether the wrapping `<label>` overlap masks a
      real hit-target issue. If smoke surfaces miss-clicks: tighten
      label / input layout (e.g. wrap input in a flex container
      with explicit pointer-events targeting). Trigger: smoke
      finding or user-reported click reliability issue. Not
      blocking IM-06 ship.

- [ ] **IM-06-polish-4** Preserve field-picks across mode-switch
      in the conflict dialog. Current behaviour (W1 lean):
      switching from `field-by-field` to `mine` / `theirs` and
      back discards per-field picks. Cleaner state transitions
      but more user effort if the same picks need to be
      re-entered. Trigger: smoke-walk scenario 10 finding or
      user report of frustration. Not blocking IM-06 ship.

## Internationalization (I18N-series)

- [x] **I18N-03** Stellvertreter / caregiver-profile messaging on the
      create form and the /profiles list. Closes the gap between the
      "Lebende Gesundheit" article-series narrative and the shipped
      UI flagged by the 2026-06-02 audit: the proxy use case was
      present as a radio option and a badge but never explained
      anywhere visible. Adds a new `form.type-hint` caption under
      the Profiltyp radio fieldset, rewrites `profile-create:intro`
      to work in both first-run and add-another contexts (drops
      "dein erstes"), extends `profile-list:screen.description` and
      `screen.empty` so both profile types are named in the empty
      state and the on-screen guidance. DE + EN parity; EN aligned
      to the README vocabulary ("caregiver profile", "elderly
      parent or child"). No schema change, no business-logic
      change. Shipped 2026-06-02 in this commit.

## Phase 6 follow-up: Backup

- [ ] **B-05** Merge-mode backup import. **Deferred.** Requires a
      clearer use case than the current single-device MVP provides.
      Re-evaluate at Phase 8 (multi-profile M-series) planning or if
      multi-device sync is considered. See B-05 scope analysis in the
      2026-04-21 B-02 follow-up (Q1-Q6 locks).

## Phase 8: Multi-Profile (activated 2026-06-02)

Status: M-01..M-05 shipped in the four-phase track on 2026-06-02
(see `CHANGELOG.md` `[Unreleased]` for the rollup). Schema-side
groundwork (`profileId` on every entity row) was in place from
day one.

Follow-up not currently scheduled:

- [ ] **M-05 import-as-new-profile** Backup _import_ path that adds
      the incoming profile to the existing vault rather than
      overwriting. Requires FK rewiring + collision handling
      overlapping heavily with the IM-06 field-level merge engine.
      Trigger: a real-user request, or scheduled work to unify the
      merge engines for both import paths.

## Phase 9: Derived Plans (future)

- [ ] **DP-01** Diet plan template (target weight, caloric deficit,
      profile constraints).
- [ ] **DP-02** Training plan template (respects joint issues, pulse
      zones, known limitations).
- [ ] **DP-03** Supplement plan template (keep / pause / on-demand
      categories).
- [ ] **DP-04** Medication plan template.
- [ ] **DP-05** Doctor-focused export format (condensed profile for
      clinical visits, separate from full export).
- [ ] **DP-06** AI-assisted plan derivation with enforced disclaimer
      presence and audit trail of AI suggestions.

## Deployment

- [ ] **D-02** Custom domain (optional; requires registrar + CNAME +
      DNS verification). Also unlocks an authoritative host-root
      `robots.txt`/`sitemap.xml` (see D-04 caveat).
- [ ] **D-04 post-deploy validation** SEO/social metadata shipped
      (`index.html` meta + Open Graph + Twitter Card + JSON-LD
      `WebApplication`, `public/og-image{,-en}.png`, `robots.txt`,
      `sitemap.xml`). Outstanding: one-time crawler validation walk
      after the next deploy, per
      [`d-04-seo-social-metadata.md`](manual-smoke/d-04-seo-social-metadata.md).
- [ ] **D-03** PWABuilder packaging for app stores. Manifest-side
      prep done (`id`, `display_override`, `launch_handler` in
      `vite.config.ts`; maintainer runbook at
      [`d-03-pwabuilder.md`](d-03-pwabuilder.md)). Outstanding:
      capture screenshots, run the PWABuilder web flow, register
      Microsoft Partner Center + Google Play accounts, submit.
      Maintainer-driven; cannot be automated.

## User documentation (DOC-series)

- [ ] **DOC-01 Iteration 2** In-app help links + opt-in onboarding
      tour. Scoped in the exploration document; deferred until
      prioritised.
- [ ] **DOC-01 Iteration 3** Full build-out, additional locales,
      community contribution path. Scoped in the exploration
      document; deferred until prioritised.

## Tech debt (carry-overs)

- [ ] **Setup chunk headroom 9 KB** - `.size-limit.json` "Setup lazy
      chunks" entry sits at 240.96 / 250 KB. Any `@zxcvbn-ts/core` or
      `@zxcvbn-ts/language-common` minor bump that adds >9 KB breaks
      CI. Pinning is in place (ADR-0014); monitor for version updates
      and re-measure on each bump.
- [ ] **zxcvbn-ts language packs not shipped** - ADR-0014 Option C
      omits `language-en` and `language-de` (would have added ~931 KB
      gzipped). Random dictionary words, compound words, and
      names-as-passwords pass as "strong". Revisit if usability
      study, community feedback, or security review surfaces a
      concrete need.

## Coverage gaps (from `docs/audits/current-coverage.md`)

Closed by **TD-16** (2026-06-29): the `src/db/repositories/**`,
`src/db/**`, and `src/router/**` threshold violations carried since
the 2026-05-02 audit are resolved; `make test-coverage` passes every
per-module threshold. Targeted branch tests were added for the
profile-active-id resolution paths (stale id, throwing/absent
`localStorage`), the `saveMultiAIConfig` missing-meta guard, the
local-provider `baseUrl` parse branch, and the router auth/profile
guards including the `cancelled`-cleanup branches.

## Working agreements

- New work follows `.claude/rules/task-series.md` for prefix
  selection. Add a series prefix only when the work is series-scope.
- Each task ships in one commit referencing the task ID in
  brackets per `.claude/rules/release-workflow.md`.
- Erledigte Tasks landen sofort im `[Unreleased]`-Block von
  `CHANGELOG.md`. Diese ROADMAP wird gepflegt, indem **erledigte
  Items entfernt werden**, nicht abgehakt.
- Beim naechsten Release: `[Unreleased]` zu versionierter Section
  promoten, neue leere `[Unreleased]` einfuegen, ROADMAP bleibt
  unveraendert (sie listet nur, was noch offen ist).
