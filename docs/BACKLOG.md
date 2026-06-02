# Phylax Backlog

Prioritised execution order for the open items in
[`ROADMAP.md`](ROADMAP.md). The ROADMAP groups tasks by phase / series;
this file orders them by **leverage divided by effort**, with explicit
"actionable now" vs "blocked on X" buckets so a session can pick the
top of the actionable list without re-reading the ROADMAP.

Convention: when an item ships, remove it both from this file and
ROADMAP, then add a CHANGELOG `[Unreleased]` entry per
`.claude/rules/release-workflow.md`.

## Tier 1 - Actionable now (sorted by leverage / effort)

Tier 1 is empty: every actionable code-side row has shipped.
All four "Coverage P0" rows in
`docs/audits/current-coverage.md` are resolved. The AI-provider
wizard has a clean add-flow. PWABuilder manifest prep is in place
(execution moved to Tier 2 user-blocked). The Settings README is
back in sync with the shipped sections.

The next code-side work has to come from new audit findings, user
feedback, or one of the trigger-bound items in Tier 3 firing. In
the meantime, the queue is dominated by maintainer-driven
manual smokes and store-submission work in Tier 2.

## Tier 2 - User-blocked (can only be done by the maintainer)

These cannot be ticked off by an agent or a CI run; they require a
real human in front of a real browser / a screen reader / a market.

- **P-01** Tier 2 mobile-sweep walk. Tier 1 automated viewport sweep is
  green; the manual walk-through at
  [`manual-smoke/p-01-mobile-sweep.md`](manual-smoke/p-01-mobile-sweep.md)
  needs sign-off.
- **P-07-d** A11y screen-reader sweep (NVDA / VoiceOver / Orca /
  TalkBack). Requires at least one SR installed and walked.
- **IM-05 Option B smoke walk**
  ([`manual-smoke/im-05-option-b-merge.md`](manual-smoke/im-05-option-b-merge.md)).
- **AIP-01..05 smoke walk**
  ([`manual-smoke/ai-multi-provider.md`](manual-smoke/ai-multi-provider.md)).
- **D-02 Custom domain** - blocked on the user picking a domain. Once
  the registrar + name are decided, the work itself is ~30 min (DNS
  CNAME + Pages config). Until then it cannot proceed.
- **D-03 PWABuilder packaging execution** - manifest-side prep
  shipped (id / display_override / launch_handler in
  [`vite.config.ts`](../vite.config.ts), maintainer runbook at
  [`d-03-pwabuilder.md`](d-03-pwabuilder.md)). The remaining work
  is maintainer-driven: capture screenshots, run the PWABuilder
  web flow for `.msixbundle` and `.aab`, register the Microsoft
  Partner Center + Google Play console accounts, and submit.
  Cannot be automated (account credentials, screenshot
  judgement, store-policy decisions).

## Tier 3 - Trigger-bound (wait for an external signal before shipping)

These have explicit trigger conditions in ROADMAP. Do nothing until
the trigger fires.

- **P-11** ES / FR / EL translations. Trigger: bug-clean state PLUS
  per-language scope spec, where bug-clean is defined as: no open
  BUG- entries in ROADMAP AND no P0 audit findings open AND no E2E
  flake reports in the last 7 days.
- **P-13** Image viewer GPU zoom. Trigger: user reports zoom-jank on a
  real scan, or a perf audit shows >100 ms scripting cost per zoom step.
- **P-14** Image viewer pinch-zoom. Trigger: a manual smoke or user
  report flags pinch-zoom missing on mobile.
- **P-15** Document link picker combobox. Trigger: any profile crosses
  ~30 themes / observations / lab values that surface in the link
  picker.
- **AIP-polish-2** Generic structured-output abstraction. Trigger: a
  second provider needs tool calling.
- **AIP-polish-3** Proxy-server infrastructure for CORS-blocked
  providers. Trigger: a real-world deployment scenario demands it.
- **B-05** Merge-mode backup import. Trigger: Phase 8 multi-profile
  planning or a multi-device-sync requirement.
- **X-10** All-profiles PDF export option, producing one document that
  spans every profile on the device rather than only the active one.
  Trigger: an explicit user request for a single PDF covering multiple
  profiles, OR a maintainer-confirmed caregiver workflow where exporting
  each profile separately is demonstrably impractical (reported in a
  smoke walk or user message). The mere existence of more than one
  profile does not fire this: per-profile separation is the intended
  default and combining profiles in one file carries a privacy cost.
- **TD-14** Unify the proxy-profile wording between the predicate-form
  create-form radio ("Stellvertretend für jemand anderen") and the
  noun-form badge ("Stellvertreterprofil"), and resolve the EN
  proxy-vs-caregiver lexical split, across all locales. Trigger:
  user-reported confusion about the term in any language, OR a
  translation-review task (e.g., P-11 ES / FR / EL) that forces a
  decision on the canonical noun.
- **TD-15** Add a JSDoc note to `useExportData` stating that the hook
  resolves the active profile only, so every export format is scoped to
  the current profile and not to all profiles. Trigger: any future PR
  modifying the data-loading or profile-resolution logic in
  `src/features/export/useExportData.ts`, OR a maintainer-reported
  confusion about active-profile scoping in the export pipeline.

## Tier 4 - Deferred / future (out-of-scope for the next release)

- **DOC-01 Iteration 2** (in-app help links + opt-in onboarding tour) -
  scoped, deferred until prioritised.
- **DOC-01 Iteration 3** (full build-out, additional locales,
  community contribution path) - scoped, deferred.
- **Phase 9 Derived Plans** (DP-01..DP-06) - future.

## Tech-debt carry-overs (monitor, do not actively work)

- **Setup chunk headroom 9 KB** - watch `.size-limit.json` "Setup lazy
  chunks" against `@zxcvbn-ts/*` minor bumps.
- **zxcvbn-ts language packs not shipped** - revisit if usability
  study, community feedback, or security review surfaces a concrete
  need.

## Working agreements

- Pick the top Tier-1 row that fits the available time slot. Do not
  skip down the list unless the top row is blocked.
- Each row ships in one commit referencing the task ID in brackets
  per `.claude/rules/release-workflow.md`.
- After shipping, remove the row from this file and the matching
  ROADMAP entry; add a CHANGELOG `[Unreleased]` line.
- This file is regenerated whenever the ROADMAP is reset (e.g., at
  the next release boundary). Treat it as derived but version-
  controlled so the prioritisation decisions are themselves part of
  the audit trail.
