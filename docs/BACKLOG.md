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

| #   | Task                                                   | Why it's first                                                                                                                                                                        | Effort                         |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | **Coverage P0 - `src/ui` ErrorBoundary recovery path** | 82.50% on a security-relevant boundary (catches every render-tree crash). Throw-in-child test + assert fallback + reset.                                                              | ~45 min                        |
| 2   | **Coverage P0 - `features/backup-import` error paths** | 82.10%; backup restore is data-integrity critical (half-applied restore = inconsistent vault). Add partial-decrypt and quota-exceeded mid-restore tests.                              | ~1 h                           |
| 3   | **P-05 ChangePassword Settings layout polish**         | The P-06 flow is shipped; the Settings page placeholder is the visible gap. Small UI cleanup, no new behaviour.                                                                       | ~30 min                        |
| 4   | **AIP-polish-1 explicit Add-Provider button**          | Currently the wizard opens pre-filled with the active provider; an explicit "Add provider" CTA removes the implicit-radio-switch confusion. Small, ships without an upstream trigger. | ~1 h                           |
| 5   | **D-02 Custom domain** (optional, deployment polish)   | One-time DNS work plus a CNAME. Only do this if the user has a domain in mind.                                                                                                        | ~30 min once domain is decided |
| 6   | **D-03 PWABuilder packaging**                          | Needs the live URL from D-01 (already shipped). One-shot upload to PWABuilder, generates Play Store / Microsoft Store packages.                                                       | ~1 h                           |

After Tier 1 closes, four of the five "Coverage P0" rows in
`docs/audits/current-coverage.md` are gone, the Settings page is
visually consistent, and the AI-provider wizard has a clean
add-flow.

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
- **P-22b/c/d-polish** Tier 2 sign-off
  ([`manual-smoke/p-22-b-c-d-match-nav.md`](manual-smoke/p-22-b-c-d-match-nav.md)).

## Tier 3 - Trigger-bound (wait for an external signal before shipping)

These have explicit trigger conditions in ROADMAP. Do nothing until
the trigger fires.

- **P-11** ES / FR / EL translations. Trigger: bug-clean state plus a
  per-language scope spec.
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

## Tier 4 - Deferred / future (out-of-scope for the next release)

- **DOC-01 Iteration 2** (in-app help links + opt-in onboarding tour) -
  scoped, deferred until prioritised.
- **DOC-01 Iteration 3** (full build-out, additional locales,
  community contribution path) - scoped, deferred.
- **Phase 8 Multi-Profile** (M-01..M-05) - deprioritised 2026-05-01.
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
