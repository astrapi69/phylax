# Documentation freshness audit - 2026-09-01

**Audit date:** 2026-09-01 | **Commit:** b93ad3b

---

## Summary

Audit of nine documentation surfaces against actual code and git history
(`git log --oneline -200`). The previous freshness audit was 2026-07-01
(commit ef84726). Since then, four commits landed:

- `8d7cec5` TD-18: kill surviving mutants, restore nightly mutation gate
- `3c06869` docs: register M-05/M-06 + IM-06 polish triggers, P-07-d smoke
- `1ded41d` TD-19: Prettier re-format (40 files, no logic change)
- `b93ad3b` R-06: repo-wide rename Phylax -> Befaro + SEO foundation refresh

R-06 touched CLAUDE.md, README.md, docs/CONCEPT.md, .claude/rules/architecture.md,
and .claude/prompts/audit.md but left the majority of the 2026-07-01 A-level findings
unresolved. It also introduced one new A-level finding (broken `cd` instruction).

| Category                          | Count  |
| --------------------------------- | ------ |
| A - stale claim (must-fix)        | 13     |
| B - missing coverage (should-fix) | 6      |
| C - stylistic drift (nice-to-fix) | 1      |
| **Total**                         | **20** |

Highest-leverage items for a single fix batch:

- **A1** `.claude/prompts/audit.md:3` still reads "React 18"; every audit
  seeded from this prompt will claim the wrong framework.
- **A3/A5-A8** `README.md` and `docs/CONCEPT.md` still describe Phase 8
  multi-profile as deferred/future; M-01..M-05 shipped 2026-06-02.
- **A13** `README.md:258` `cd befaro` is wrong after `git clone phylax.git`;
  new regression introduced by R-06.

---

## Per-file findings

### .claude/prompts/audit.md

| File:Line    | Type            | Priority | Reason                                                                                                                                             | Recommended Action                 |
| ------------ | --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `audit.md:3` | A - stale claim | P0       | Still reads "React 18 + TypeScript PWA". R-06 modified this file (8 lines) but did not fix the framework version. Package.json shows `^19.2.6`. Every future audit seeded from this prompt will carry a wrong assertion. | Replace "React 18" with "React 19". |

---

### README.md

| File:Line             | Type                 | Priority | Reason                                                                                                                                                                                                                                   | Recommended Action                                                                                      |
| --------------------- | -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `README.md:221`       | A - stale claim      | P1       | Reads "TypeScript 6, Vite 7 / Vitest 4". `package.json` shows `"vite": "^8.0.11"`. The Vite 8 upgrade shipped in commits 61dd1da + a476447 (ROADMAP V8 track closed). R-06 made 58 changes to README but did not update this line.      | Change "Vite 7" to "Vite 8".                                                                            |
| `README.md:228`       | A - stale claim      | P1       | Reads "Deferred: Phase 8 multi-profile (deprioritised 2026-05-01)". ROADMAP says "Phase 8: Multi-Profile (activated 2026-06-02)"; M-01..M-05 shipped in commits 65b5e37..f75f49e. Unresolved since the 2026-07-01 audit.                | Replace "Deferred" entry with a shipped summary matching the CHANGELOG `[Unreleased]` M-series rollup. |
| `README.md:258`       | A - stale claim      | P1       | Quick-start block reads `git clone https://github.com/astrapi69/phylax.git` then `cd befaro`. The cloned directory is named after the repo (`phylax`), not the app. New regression introduced by R-06 rename.                           | Change `cd befaro` to `cd phylax` (until the GitHub repo itself is renamed, tracked as TD-20).         |
| `README.md:406-414`   | A - stale claim      | P2       | Contributing section reads "For v1.0.0, pull requests are deferred" / "Pull requests will be accepted after v1.0.0 ships." v1.0.0 shipped 2026-04-18; current work follows Gitflow per ADR-0024. Unresolved since the 2026-07-01 audit. | Rewrite Contributing section to reflect the post-1.0 Gitflow policy per ADR-0024.                     |
| `README.md:53-66`     | A - stale claim      | P2       | Four screenshot image tags reference `./docs/screenshots/` which does not exist. The README renders broken images on GitHub. Unresolved since the 2026-07-01 audit.                                                                      | Remove the broken `<img>` / TODO blocks until screenshots are created.                                  |
| `README.md:231,284`   | B - missing coverage | P2       | Test count "2632 unit tests across 279 files" predates M-01..M-05, I18N-03, TD-16, BUG-12..14, and R-06. Actual count requires re-running `make test`.                                                                                  | Run `make test` and update both occurrences.                                                           |
| `README.md` (features) | B - missing coverage | P2       | Multi-profile support (M-01..M-05): profile switcher, ActiveProfileContext, per-profile export filter, caregiver badge - none appear in the features list. Shipped 2026-06-02.                                                           | Add a Multi-Profile bullet to the features list.                                                       |

---

### docs/CONCEPT.md

| File:Line        | Type            | Priority | Reason                                                                                                                                                                                   | Recommended Action                                                                         |
| ---------------- | --------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `CONCEPT.md:183` | A - stale claim | P1       | "Im MVP wird genau ein Profil pro Installation unterstützt." Multi-profile shipped M-01..M-05 (2026-06-02). R-06 modified CONCEPT.md (36 lines) but left this claim intact.              | Update to state that multi-profile support is live since 2026-06-02.                       |
| `CONCEPT.md:267` | A - stale claim | P1       | "Im MVP existiert genau ein Profil." Same error as line 183. Unresolved since the 2026-07-01 audit.                                                                                      | Update similarly.                                                                          |
| `CONCEPT.md:281` | A - stale claim | P1       | Phase table row `8 (Zukunft) | Multi-Profil` lists multi-profile as a future phase. Shipped 2026-06-02. Unresolved since the 2026-07-01 audit.                                          | Update the phase table to mark Phase 8 as shipped.                                        |
| `CONCEPT.md:293` | A - stale claim | P1       | "Multi-Profil nicht im MVP (aber Datenmodell vorbereitet)" in the non-goals list. The data model AND the feature are both live. Unresolved since the 2026-07-01 audit.                   | Remove or rewrite: multi-profile is no longer a non-goal.                                  |

---

### CLAUDE.md

| File:Line         | Type            | Priority | Reason                                                                                                                                                                               | Recommended Action                                                                                             |
| ----------------- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md:51`    | A - stale claim | P2       | Project structure shows `│   ├── i18n/  # Übersetzungen (de, en)`. Actual translation JSONs live in `src/locales/de/*.json` / `src/locales/en/*.json`; `src/i18n/` holds only infrastructure (`config.ts`, `detector.ts`, `index.ts`). R-06 modified CLAUDE.md (20 lines) but did not fix this. Unresolved since 2026-07-01. | Change annotation to "i18n infrastructure (config, detector, index)"; add a `src/locales/` entry.             |
| `CLAUDE.md:63`    | A - stale claim | P2       | `└── tailwind.config.ts` listed in the project tree. This file does not exist; Tailwind 4 uses CSS-based config (`src/index.css` + `@tailwindcss/postcss`). Unresolved since 2026-07-01. | Remove `tailwind.config.ts` from the project tree.                                                            |

---

### docs/ROADMAP.md

No new stale claims introduced since 2026-07-01. Open items correctly reflect
post-1.1.0 state. I-05..I-10 marked `[x]`. The M-01..M-05 track is described
as "activated 2026-06-02". TD-20 (legacy `phylax` identifier migration) is
registered and accurately describes the intentional deferral. No action needed.

---

### CHANGELOG.md

`[Unreleased]` block is current and well-structured. R-06 entry is detailed
and accurate. All task IDs and commit SHAs cross-check against `git log`.
No stale claims found.

---

### docs/decisions/ (ADR completeness)

| Finding       | Type | Priority | Reason                                                                                                                                                                                                 | Recommended Action |
| ------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| ADR numbering | Info | P3       | ADR-0001 through ADR-0024 are contiguous; no numbering gaps. Header convention `**Date:** / **Status:**` consistent across spot-checked files (ADR-0001, ADR-0023, ADR-0024). Cross-links intact. No action needed. | -                  |

---

### docs/manual-smoke/

| File:Line                      | Type                 | Priority | Reason                                                                                                                                                                                                              | Recommended Action                                                                                   |
| ------------------------------ | -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `manual-smoke/README.md:105`   | A - stale claim      | P1       | Backlog row for P-22b/c/d-polish shows Status "Pending walk". CHANGELOG records the smoke as signed off and commits d187480 ticked all eight scenarios in `p-22-b-c-d-match-nav.md`. Unresolved since 2026-07-01.  | Update Status to "Complete (2026-05-04; all 8 scenarios pass)".                                     |
| `manual-smoke/README.md:106`   | A - stale claim      | P2       | IM-05 Option B row shows Status "Pending walk". `im-05-option-b-merge.md` carries a "SUPERSEDED BY IM-06" banner. Unresolved since 2026-07-01.                                                                      | Update Status to "Superseded by IM-06 (2026-05-04)".                                               |
| `manual-smoke/README.md` table | B - missing coverage | P2       | `im-06-field-level-merge.md` smoke file exists and scenarios 3-20 are unsigned. No row in the backlog table, making it invisible to new walkers. Unresolved since 2026-07-01.                                       | Add row: `IM-06 \| Field-level merge \| Pending walk (scenarios 3-20)`.                              |
| `manual-smoke/README.md` table | B - missing coverage | P3       | `d-04-seo-social-metadata.md` smoke file exists (one-time post-deploy validation) with no entry in the backlog table. Unresolved since 2026-07-01.                                                                  | Add row: `D-04 \| SEO/social metadata post-deploy \| Pending (one-time post-deploy walk)`.          |

---

### docs/audits/

| File:Line                    | Type                 | Priority | Reason                                                                                                                                                                                                                                                                                                              | Recommended Action                                                                                                               |
| ---------------------------- | -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `current-coverage.md` header | B - missing coverage | P1       | Audit date is 2026-05-04 - nearly four months stale as of 2026-09-01. Significant features shipped since: M-01..M-05, SOFT-RESET, IM-06, I18N-03, BUG-12..14, I-05..I-10, TD-16..TD-19, R-06. Test counts and per-module figures are likely materially different. Flagged as stale in the 2026-07-01 audit; unresolved. | Archive to `history/2026-05-04-coverage.md`, run `make test-coverage`, write a new `current-coverage.md`.                       |

---

### .claude/rules/\*.md

| File:Line                              | Type            | Priority | Reason                                                                                                                                                             | Recommended Action                                                                                  |
| -------------------------------------- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `.claude/rules/architecture.md:57-59`  | A - stale claim | P2       | Folder structure lists `de.json` / `en.json` under `i18n/`. Actual translation JSONs live under `src/locales/`. R-06 made 8 changes to this file but did not fix the i18n path. Unresolved since 2026-07-01. | Mirror the CLAUDE.md fix: correct `i18n/` to infrastructure only, add `src/locales/` entry.        |
| `quality-checks.md` mutation table     | Info            | P3       | Mutation baseline dates are 2026-04-16. TD-18 (commit 8d7cec5) killed surviving mutants to restore the gate; table prose still shows the pre-TD-18 baseline date. The CI nightly is authoritative; prose is a snapshot. | Update the table date to 2026-08-xx (TD-18 ship date) and re-measure baseline after next nightly.  |

---

## Cross-file consistency

| Finding                     | Files                                                                                                                                                                              | Priority |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| React version conflict      | `audit.md:3` says "React 18"; `CLAUDE.md:21` says "React 19"; `package.json` shows `^19.2.6`. ADR-0021 is source of truth.                                                       | P0       |
| Vite version conflict       | `README.md:221` says "Vite 7"; `package.json` shows `^8.0.11`; ROADMAP V8 track is `[x]`.                                                                                         | P1       |
| Phase 8 status conflict     | `README.md:228` says deferred; `ROADMAP.md` says activated 2026-06-02; `CONCEPT.md:281` says Zukunft. Three files, three different signals.                                        | P1       |
| Clone directory mismatch    | `README.md:257-258` clones `phylax.git` then runs `cd befaro`. The cloned directory will be `phylax`. New regression from R-06.                                                   | P1       |
| i18n path conflict          | `CLAUDE.md:51` and `.claude/rules/architecture.md:57-59` both reference `src/i18n/de.json`; actual files are `src/locales/de/*.json`.                                             | P2       |
| Smoke backlog inconsistency | `manual-smoke/README.md` table: P-22b/c/d shown as "Pending" (complete); IM-05 shown as "Pending" (superseded); IM-06 and D-04 rows absent.                                       | P1       |

---

## Recommended fix batch

| Rank | ID    | Category | Description                                                                                                        | Effort     | Unlocks                                                         |
| ---- | ----- | -------- | ------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------- |
| P0   | FIX-1 | A        | Correct `audit.md:3` React 18 -> React 19                                                                          | 1 line     | Every future audit reads a correct stack description            |
| P1   | FIX-2 | A        | Fix `README.md:258` `cd befaro` -> `cd phylax` (clone-dir regression from R-06)                                   | 1 line     | Quick-start instructions are executable as written              |
| P1   | FIX-3 | A        | Update `README.md:221` Vite 7 -> Vite 8                                                                            | 1 line     | README infrastructure list is accurate                          |
| P1   | FIX-4 | A/B      | Update `README.md:228` Phase 8 deferred -> shipped; add M-01..M-05 to features list                               | ~10 lines  | README project status section is current                        |
| P1   | FIX-5 | A        | Update `CONCEPT.md:183,267,281,293` multi-profile MVP claims                                                       | ~4 lines   | CONCEPT.md reflects shipped state                               |
| P1   | FIX-6 | A        | Update `manual-smoke/README.md` backlog: P-22 -> Complete, IM-05 -> Superseded, add IM-06 and D-04 rows           | ~8 lines   | Smoke backlog is navigable without cross-referencing each file  |
| P1   | FIX-7 | B        | Refresh `docs/audits/current-coverage.md` (archive old, run `make test-coverage`, write new)                      | 30 min     | Coverage audit reflects current codebase (R-06 + M-series)     |
| P2   | FIX-8 | A        | Correct `CLAUDE.md:51,63` and `architecture.md:57-59`: i18n paths and remove `tailwind.config.ts`                 | ~6 lines   | New contributors not misled by the project tree                 |
| P2   | FIX-9 | A        | Update `README.md:406-414` Contributing section: v1.0.0 shipped, Gitflow now in effect (ADR-0024)                 | ~6 lines   | Contributing guidance matches current practice                  |
| P2   | FIX-10 | A       | Remove broken screenshot blocks from `README.md:53-66` or create `docs/screenshots/`                              | varies     | Broken images removed from public README                        |
| P2   | FIX-11 | B       | Run `make test` and update test count in `README.md:231,284`                                                       | 1 min run  | Test count is not stale                                         |
| P3   | FIX-12 | C       | Add missing dirs to `CLAUDE.md` structure (`src/pwa/`, `src/router/`, `src/test/`, `src/locales/`, `tests/e2e-production/`) | ~8 lines | Project tree matches filesystem |

FIX-1 through FIX-6, FIX-8, FIX-9, FIX-11 can be batched into a single docs PR. FIX-7
requires a local `make test-coverage` run before committing. FIX-10 is maintainer-driven
(screenshots require the running app). FIX-12 is low-priority cleanup.

---

## Out-of-scope observations

- `phylax-` storage key prefix in CLAUDE.md is intentional and correctly documented as
  pending TD-20 migration; not a finding.
- `docs/BACKLOG.md` Tier 1 is empty. Tier 2 and 3 entries cross-check with ROADMAP without contradiction.
- `docs/ci-gates.md` job names still match `.github/workflows/ci.yml`. No drift found.
- ADR-0002 title says "deferred" but crypto module is fully extracted; this is an immutable
  historical record, not a finding.
- TD-18 (mutation gate restore, commit 8d7cec5) is not yet reflected in the mutation table
  prose in `quality-checks.md`; flagged as Info/P3 above.
- SECURITY.md was added; no coverage issues found in a quick scan.
