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
- [ ] **P-05** Settings polish: change-master-password section reaches
      feature parity with the rest of the Settings layout. P-06 has
      shipped the underlying flow; this task is the Settings-page
      placeholder cleanup.
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

- [ ] **AIP-polish-1** Add-new-provider explicit UX. The "Anbieter
      verwalten" wizard currently opens pre-filled with the active
      provider; switching to a new provider type is implicit. Revisit
      with a dedicated "Add provider" button if user feedback
      indicates confusion.
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

## Phase 6 follow-up: Backup

- [ ] **B-05** Merge-mode backup import. **Deferred.** Requires a
      clearer use case than the current single-device MVP provides.
      Re-evaluate at Phase 8 (multi-profile M-series) planning or if
      multi-device sync is considered. See B-05 scope analysis in the
      2026-04-21 B-02 follow-up (Q1-Q6 locks).

## Phase 8: Multi-Profile (deprioritised 2026-05-01)

Status: deprioritised; no active work scheduled. Profile schema
already carries `profileId` from day one (per `.claude/rules/architecture.md`),
so future activation does not require schema migration.

- [ ] **M-01** Profile list view: show all profiles, switch between
      them.
- [ ] **M-02** Create new profile: own or proxy (Stellvertreterprofil).
- [ ] **M-03** Proxy profile metadata: managed-by field, relationship.
- [ ] **M-04** Profile-scoped views: all screens filter by active
      profileId.
- [ ] **M-05** Backup / restore per profile or all profiles.

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
      DNS verification).
- [ ] **D-03** PWABuilder packaging for app stores (needs the live
      URL from D-01, which has shipped).

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

These are the four threshold-violating modules surfaced by the
2026-05-02 coverage audit. They are tracked here so they appear in
the same priority queue as feature work.

- [ ] **Coverage P0 - `src/ui` 82.50% lines** (threshold 85%).
      Dominant gap is `ErrorBoundary.tsx` (lines 79-83, 99-114).
      Test the recovery path: throw inside a child, assert fallback
      UI plus reset behaviour.
- [ ] **Coverage P0 - `features/backup-import` 82.10% lines**.
      `useBackupImport.ts` carries the bulk of the gap. Add
      error-path tests for partial-decrypt failure and
      quota-exceeded mid-restore.
- [ ] **Coverage P0 - `features/not-found` 0% lines**. Stub view
      lines 5-6 only. A smoke render test closes the gap.
- [ ] **Coverage P0 - `features/search-trigger` 75.00% lines**.
      `SearchContext.tsx` lines 104-107, 135-137 uncovered. Add
      tests for keyboard-shortcut and outside-click branches.

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
