# Documentation freshness audit - 2026-07-01

**Audit date:** 2026-07-01 | **Commit:** ef84726

---

## Summary

Audit of nine documentation surfaces against actual code and git history
(`git log --oneline -200`). The last significant doc sweep was the
2026-05-02 codebase audit. Since then, five feature tracks shipped:
SOFT-RESET, IM-06 field-level merge, X-09 PDF overhaul, M-01..M-05
multi-profile, I18N-03 caregiver messaging, plus I-05..I-10
infrastructure rules and BUG-12..14 fixes.

| Category | Count |
|----------|-------|
| A - stale claim (must-fix) | 12 |
| B - missing coverage (should-fix) | 5 |
| C - stylistic drift (nice-to-fix) | 3 |
| **Total** | **20** |

Highest-leverage items for a single fix batch:
- **A1** `.claude/prompts/audit.md` says React 18 - the canonical audit prompt
  gates every future audit and is wrong.
- **A3/A5-A7** `README.md` and `docs/CONCEPT.md` say Phase 8 is deferred /
  future; M-01..M-05 shipped 2026-06-02.
- **B3** `docs/audits/current-coverage.md` is nearly two months stale;
  multi-profile, SOFT-RESET, and three bug-fix rounds post-date it.

---

## Per-file findings

### .claude/prompts/audit.md

| File:Line | Type | Priority | Reason | Recommended Action |
|-----------|------|----------|--------|-------------------|
| `audit.md:3` | A - stale claim | P0 | Opening line reads "React 18 + TypeScript PWA". The project is on React 19 since ADR-0021 (commit `29c7f87`); `package.json` shows `"react": "^19.2.6"`. Every future audit seeded from this prompt will carry a wrong framework assertion. | Replace "React 18" with "React 19". |

---

### README.md

| File:Line | Type | Priority | Reason | Recommended Action |
|-----------|------|----------|--------|-------------------|
| `README.md:221` | A - stale claim | P1 | Infrastructure list reads "TypeScript 6, Vite 7 / Vitest 4". `package.json` shows `"vite": "^8.0.11"`. The Vite 8 upgrade shipped in commits 61dd1da + a476447 (ROADMAP V8 track `[x]`). | Change "Vite 7" to "Vite 8". |
| `README.md:228` | A - stale claim | P1 | "Deferred: Phase 8 multi-profile (deprioritised 2026-05-01)". ROADMAP records "Phase 8: Multi-Profile (activated 2026-06-02)"; M-01..M-05 shipped in commits 65b5e37..f75f49e. | Replace "Deferred" entry with a shipped summary matching the CHANGELOG `[Unreleased]` M-series rollup at line 359. |
| `README.md:53-66` | A - stale claim | P1 | Four screenshot image tags (`./docs/screenshots/profile.png` etc.) reference a `docs/screenshots/` directory that does not exist. The README renders four broken-image placeholders. | Either create the screenshots and directory, or remove the broken tags until screenshots are ready. |
| `README.md:406-414` | A - stale claim | P2 | Contributing section reads "For v1.0.0, pull requests are deferred" and "Pull requests will be accepted after v1.0.0 ships." v1.0.0 shipped 2026-04-18; current version is 1.1.0. The gate this sentence described has been open for over two months. | Rewrite the Contributing section to reflect current contribution policy under Gitflow (ADR-0024). |
| `README.md:231,284` | B - missing coverage | P2 | Test count "2632 unit tests across 279 files" / "make test # Unit tests (2632 tests)". This count predates M-01..M-05, I18N-03, TD-16, BUG-12..14. No re-verification after those shipments. Actual current count is unknown without re-running `make test`. | Run `make test` and update both occurrences with the current count. |
| `README.md` features list | B - missing coverage | P2 | Multi-Profile support (M-01..M-05): profile switcher route, ActiveProfileContext, per-profile export filter, in-app create-with-cancel, caregiver badge - none appear in the features list. The "Who is Phylax for" section mentions caregiver use but the features list does not reflect the shipped functionality. | Add a Multi-Profile / Profile Switcher bullet to the features list. |

---

### docs/CONCEPT.md

| File:Line | Type | Priority | Reason | Recommended Action |
|-----------|------|----------|--------|-------------------|
| `CONCEPT.md:183` | A - stale claim | P1 | "Im MVP wird genau ein Profil pro Installation unterstützt." Multi-profile shipped M-01..M-05 (2026-06-02). The claim is now factually wrong. | Update to reflect that multi-profile support is live. |
| `CONCEPT.md:267` | A - stale claim | P1 | "Im MVP existiert genau ein Profil." Same error as line 183. | Update similarly. |
| `CONCEPT.md:281` | A - stale claim | P1 | Phase table row `| 8 (Zukunft) | Multi-Profil |` lists multi-profile as a future planned phase. Shipped 2026-06-02. | Update the phase table to mark Phase 8 as shipped or move it to the archived phases narrative. |
| `CONCEPT.md:293` | A - stale claim | P1 | "Multi-Profil nicht im MVP (aber Datenmodell vorbereitet)" in the feature scope exclusion list. No longer accurate: the data model AND the feature are live. | Remove or rewrite this line. |

---

### CLAUDE.md

| File:Line | Type | Priority | Reason | Recommended Action |
|-----------|------|----------|--------|-------------------|
| `CLAUDE.md:58-59` | A - stale claim | P2 | Project structure shows `src/i18n/de.json` and `src/i18n/en.json`. Actual `src/i18n/` contains only `config.ts`, `detector.ts`, `index.ts` (infrastructure). Translation JSONs live in `src/locales/de/*.json` and `src/locales/en/*.json` - a `src/locales/` subtree absent from the CLAUDE.md layout entirely. | Add `src/locales/` to the structure; correct `src/i18n/` description to "i18n infrastructure (config, detector, index)". |
| `CLAUDE.md:63` | A - stale claim | P2 | `tailwind.config.ts` listed in the project tree. This file does not exist. Tailwind 4 uses CSS-based configuration (`src/index.css` + `@tailwindcss/postcss`). | Remove `tailwind.config.ts` from the project tree. |
| `CLAUDE.md` structure | C - stylistic drift | P3 | Project tree omits: `src/pwa/`, `src/router/`, `src/test/`, `tests/e2e-production/`, `tests/fixtures/`. These directories exist and contain substantive code (router has auth guards and route definitions; pwa has SW registration; test has shared setup). | Add missing directories with one-line annotations matching the established comment style. |

---

### docs/ROADMAP.md

No stale claims found. Open items correctly reflect post-1.1.0 state. I-05..I-10 completed and marked `[x]`. M-01..M-05 described as "activated 2026-06-02" with correct commit references. All open items carry valid trigger conditions or user-bound gates.

---

### CHANGELOG.md

No stale claims found. `[Unreleased]` block is current and well-structured. The M-01..M-05 rollup at line 359 is detailed and accurate. All task IDs and commit SHAs cross-check against `git log`.

---

### docs/decisions/ (ADR completeness)

| Finding | Type | Priority | Reason | Recommended Action |
|---------|------|----------|--------|-------------------|
| ADR numbering | Info | P3 | ADR-0001 through ADR-0024 are contiguous; no gaps. Header convention `**Date:** / **Status:**` is consistent across all 24 files (spot-checked ADR-0022..0024). Cross-links within ADRs reference correct file names. No action needed. | - |

---

### docs/manual-smoke/

| File:Line | Type | Priority | Reason | Recommended Action |
|-----------|------|----------|--------|-------------------|
| `manual-smoke/README.md:104` | A - stale claim | P1 | Backlog table row for P-22b/c/d-polish shows Status "Pending walk". CHANGELOG line 144 records "P-22b/c/d match-nav polish manual smoke signed off"; the smoke file `p-22-b-c-d-match-nav.md` shows all eight scenarios marked `☑ pass`. | Update row Status to "Complete (2026-05-04; all 8 scenarios pass)". |
| `manual-smoke/README.md:105` | A - stale claim | P2 | IM-05 Option B row shows Status "Pending walk". `im-05-option-b-merge.md` carries a "SUPERSEDED BY IM-06" banner explicitly warning "do not walk against the current UI". | Update row Status to "Superseded by IM-06 (2026-05-04)". |
| `manual-smoke/README.md` | B - missing coverage | P2 | `im-06-field-level-merge.md` smoke file exists and is actively pending (scenarios 3-20 unsigned, walker line blank). It appears in `docs/BACKLOG.md` Tier 2 but has no row in the README backlog table, making it invisible to new walkers. | Add a row: `| IM-06 | [Field-level merge](im-06-field-level-merge.md) | Pending walk (scenarios 3-20) |`. |
| `manual-smoke/README.md` | B - missing coverage | P3 | `d-04-seo-social-metadata.md` smoke file shipped with the D-04 SEO feature (CHANGELOG `[Unreleased]`) but has no entry in the backlog table. It is a one-time post-deploy walk, not a recurring smoke, but absence from the table leaves its status invisible. | Add a row: `| D-04 | [SEO/social metadata post-deploy](d-04-seo-social-metadata.md) | Pending (one-time post-deploy walk) |`. |

---

### docs/audits/

| File:Line | Type | Priority | Reason | Recommended Action |
|-----------|------|----------|--------|-------------------|
| `current-coverage.md` header | B - missing coverage | P1 | Audit date is 2026-05-04 - nearly two months stale as of 2026-07-01. Significant features shipped since: M-01..M-05 (multi-profile), SOFT-RESET, IM-06, I18N-03, BUG-12..14, I-05..I-10. Test counts and module rollup figures are likely materially different. `make test-coverage` has not been re-run since TD-16 closed the last threshold violation (2026-06-29, commit 73a7db3). | Archive `current-coverage.md` to `history/2026-05-04-coverage.md`, run `make test-coverage`, write a new `current-coverage.md`. |

---

### .claude/rules/*.md

| File:Line | Type | Priority | Reason | Recommended Action |
|-----------|------|----------|--------|-------------------|
| `.claude/rules/architecture.md:58-59` | A - stale claim | P2 | Same i18n structure error as CLAUDE.md: lists `de.json` / `en.json` under `i18n/`. Actual translation files are under `src/locales/`. | Mirror the CLAUDE.md fix here; correct `i18n/` to infrastructure only, add `locales/` note. |
| `quality-checks.md` mutation table | Info | P3 | Mutation baseline dates are 2026-04-16. Nightly Stryker results since then are not reflected in the prose table. This is expected (the CI nightly updates thresholds; prose is a snapshot). No action required unless a threshold is raised. | - |

---

## Cross-file consistency

| Finding | Files | Priority |
|---------|-------|----------|
| Phase 8 status conflict | `README.md:228` says deferred; `docs/ROADMAP.md` says "activated 2026-06-02"; `docs/CONCEPT.md:281` says "Zukunft". Three files, three different signals. | P1 |
| Vite version conflict | `README.md:221` says "Vite 7"; `package.json` says `^8.0.11`; ROADMAP V8 track is `[x]`. | P1 |
| i18n path conflict | `CLAUDE.md:58-59` and `.claude/rules/architecture.md:58-59` both say `src/i18n/de.json`; actual files are `src/locales/de/*.json`. | P2 |
| React version conflict | `.claude/prompts/audit.md:3` says "React 18"; `CLAUDE.md:21` says "React 19"; `package.json` says `^19.2.6`; ADR-0021 is the source of truth. | P0 |
| Screenshot directory | `README.md:53-66` references `docs/screenshots/` which does not exist. No other doc file compensates for this. | P1 |
| Smoke backlog inconsistency | `manual-smoke/README.md` table missing IM-06 (pending) and D-04 (pending one-time); shows IM-05 as "Pending" (superseded) and P-22b/c/d as "Pending" (complete). Four of six backlog rows need correction. | P1 |

---

## Recommended fix batch

| Rank | ID | Category | Description | Effort | Unlocks |
|------|----|----------|-------------|--------|---------|
| P0 | FIX-1 | A | Correct `audit.md` React 18 -> React 19 | 1 line | Every future audit reads a correct stack description |
| P1 | FIX-2 | A | Update README:221 Vite 7 -> Vite 8 | 1 line | README infrastructure list is accurate |
| P1 | FIX-3 | A/B | Update README:228 Phase 8 deferred -> shipped; add M-01..M-05 to features list | ~10 lines | README project status section is current |
| P1 | FIX-4 | A | Update CONCEPT.md:183,267,281,293 multi-profile MVP claims | ~4 lines | CONCEPT.md reflects shipped state |
| P1 | FIX-5 | B | Refresh `docs/audits/current-coverage.md` (archive old, run `make test-coverage`, write new) | ~30 min runtime + prose | Coverage audit reflects current codebase |
| P1 | FIX-6 | A | Update `manual-smoke/README.md` backlog table: P-22 -> Complete, IM-05 -> Superseded, add IM-06 and D-04 rows | ~8 lines | Smoke backlog is navigable without cross-referencing smoke files |
| P2 | FIX-7 | A | Correct `CLAUDE.md` and `architecture.md` i18n paths (`src/locales/` vs `src/i18n/*.json`); remove `tailwind.config.ts` | ~6 lines | New contributors not misled by the project tree |
| P2 | FIX-8 | A | Update README Contributing section: v1.0.0 shipped, Gitflow now in effect (ADR-0024) | ~6 lines | Contributing guidance is not frozen at pre-1.0 state |
| P2 | FIX-9 | A | Fix README screenshot broken links (create `docs/screenshots/` or remove TODO tags) | varies | Broken images removed from the public README |
| P3 | FIX-10 | C | Add missing dirs to CLAUDE.md structure (`src/pwa/`, `src/router/`, `src/test/`, `src/locales/`, `tests/e2e-production/`, `tests/fixtures/`) | ~8 lines | Project tree matches filesystem |

FIX-1 through FIX-6 can be batched into a single `docs/` PR. FIX-7 and FIX-8 belong in a second small PR (they touch rule files and the project's contributor-facing policy). FIX-9 is maintainer-driven (screenshots require a running app). FIX-10 is a low-priority cleanup.

---

## Out-of-scope observations

- `docs/MAINTENANCE.md` exists but was not in the audit scope. No findings surfaced from a quick scan.
- `docs/BACKLOG.md` Tier 1 is correctly empty. Tier 2 and Tier 3 entries cross-check with ROADMAP without contradiction.
- `docs/ci-gates.md` job names (`lint-typecheck`, `unit-tests`, `e2e-dev`, `e2e-production`, `build`) match the five jobs in `.github/workflows/ci.yml`. No drift found.
- ADR-0002 (`docs/decisions/ADR-0002-crypto-module-extraction-deferred.md`) title says "deferred" but the crypto module has been fully extracted since Phase 1. The ADR documents a historical decision, not current state. This is intentional (ADRs are immutable records) and not a finding.
- `docs/CONCEPT.md` Profilstruktur section (lines ~80-130) lists "Blutwerte" as a top-level section name. The code and ROADMAP use "Labwerte" / `lab_values`. This terminology gap predates this audit period and is not a new drift.
