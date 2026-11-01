# Documentation freshness audit - 2026-11-01

**Audit date:** 2026-11-01 | **Commit:** f3f9818

---

## Summary

Audit of nine documentation surfaces against actual code and git history
(`git log --oneline -200`). The previous freshness audit was 2026-09-01
(commit b93ad3b / PR #24). Since then, two commits landed:

- `75978c7` I-11 / BUG-15 / P-16: Impressum + Datenschutz scaffold,
  external-resource audit, PRIVACY.md, BUG-15 timeout fix
- `f3f9818` P-16: fill Impressum / Datenschutz with real content from
  Bibliogon template

Both commits touched legal pages exclusively. **No documentation staleness
findings from the 2026-09-01 audit were resolved** in these two commits.
The two new commits introduced two new findings (one A, one B).

| Category                          | Count  | New | Carried |
| --------------------------------- | ------ | --- | ------- |
| A - stale claim (must-fix)        | 12     | 1   | 11      |
| B - missing coverage (should-fix) | 3      | 1   | 2       |
| C - stylistic drift (nice-to-fix) | 0      | -   | -       |
| **Total**                         | **15** | 2   | 13      |

Highest-leverage items for a single fix batch:

- **A1** `.claude/prompts/audit.md:3` still reads "React 18"; five
  previous audits have flagged this. Every agent audit seeded from this
  prompt will assert the wrong framework.
- **A4-A7** `docs/CONCEPT.md` still describes multi-profile as an MVP
  non-goal and a future phase in four separate places; M-01..M-05 shipped
  2026-06-02 (5 months ago).
- **A8** `README.md:225` describes P-16 as "inline document delete" while
  the ROADMAP now defines P-16 as Impressum/Datenschutz; newly introduced
  by the recent commits and visible on the GitHub README front page.

---

## Per-file findings

### .claude/prompts/audit.md

| File:Line    | Type            | Priority | Reason                                                                                                                              | Recommended Action             |
| ------------ | --------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `audit.md:3` | A - stale claim | P0       | Reads "React 18 + TypeScript PWA". `package.json` shows `"react": "^19.2.6"` (ADR-0021). Carried since 2026-07-01 audit, still unresolved. Every agent audit seeded here will assert the wrong framework. | Replace "React 18" with "React 19". |

---

### README.md

| File:Line             | Type                 | Priority | Reason                                                                                                                                                                                                                                                            | Recommended Action                                                                                  |
| --------------------- | -------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `README.md:221`       | A - stale claim      | P1       | Reads "TypeScript 6, Vite 7 / Vitest 4". Vite 8 shipped in commits 61dd1da + a476447 (ROADMAP V8 track closed 2026-05-07). Carried since 2026-09-01 audit.                                                                                                        | Change "Vite 7" to "Vite 8".                                                                        |
| `README.md:225`       | A - stale claim      | P2       | "In progress (Phase 7 polish): ..., inline document delete (P-16), ...". P-16's scope is now Impressum / Datenschutzerklaerung per ROADMAP (shipped 2026-09-16/17 in 75978c7 + f3f9818, stays open only for lawyer pass). New regression introduced by those commits. | Replace "inline document delete (P-16)" with "Impressum / Datenschutz (P-16, lawyer-pass pending)". |
| `README.md:228`       | A - stale claim      | P1       | "Deferred: Phase 8 multi-profile (deprioritised 2026-05-01)". M-01..M-05 shipped 2026-06-02 (commits fb77928..9eb5f13). Carried since 2026-09-01 audit.                                                                                                           | Replace "Deferred" entry with a shipped summary matching the CHANGELOG M-series rollup.             |
| `README.md:404-414`   | A - stale claim      | P2       | Contributing section: "For v1.0.0, pull requests are deferred" and "Pull requests will be accepted after v1.0.0 ships." v1.0.0 shipped 2026-04-18; Gitflow with CI-gated PRs is now in force per ADR-0024. Carried since 2026-07-01 audit.                         | Rewrite to reflect the post-1.0 Gitflow policy (ADR-0024).                                         |
| `README.md:53-66`     | A - stale claim      | P2       | Four `![...](./docs/screenshots/...)` image tags reference a `docs/screenshots/` directory that does not exist. GitHub renders broken images. Carried since 2026-07-01 audit.                                                                                      | Remove the broken `<img>` / TODO screenshot blocks until actual screenshots exist.                  |
| `README.md:231,284`   | B - missing coverage | P2       | Test count "2632 unit tests across 279 files" predates M-01..M-05, I18N-03, TD-16, BUG-12..15, P-16 (ImpressumView.test, DatenschutzView.test, LegalFooter.test, legal.spec.ts), X-09, and R-06. The actual count is higher. Worsened by each new commit since May 2026. | Run `make test` and update both occurrences with the current count.                                 |
| `README.md` (features) | B - missing coverage | P2       | Multi-profile support (M-01..M-05): profile switcher, ActiveProfileContext, per-profile export filter, caregiver badge - none appear in the Features list. Shipped 2026-06-02. Carried since 2026-09-01 audit.                                                     | Add a multi-profile bullet to the Features list.                                                    |
| `README.md` (features) | B - missing coverage | P2       | Impressum / Datenschutzerklaerung (P-16): in-app legal pages, global LegalFooter, PRIVACY.md, and external-resource CI guard are shipped features (75978c7 + f3f9818, 2026-09-16/17) not mentioned anywhere in README. New finding.                               | Add a brief entry in the Features list or Project Status section; cross-link PRIVACY.md.            |

---

### docs/CONCEPT.md

| File:Line        | Type            | Priority | Reason                                                                                                                                                                                             | Recommended Action                                                  |
| ---------------- | --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `CONCEPT.md:183` | A - stale claim | P1       | "Im MVP wird genau ein Profil pro Installation unterstuetzt." Multi-profile shipped M-01..M-05 (2026-06-02). Carried since 2026-07-01 audit, unresolved through four subsequent commits.            | Update to state multi-profile is live since 2026-06-02.             |
| `CONCEPT.md:267` | A - stale claim | P1       | "Im MVP existiert genau ein Profil." Same error, second location. Carried since 2026-07-01 audit.                                                                                                   | Update similarly.                                                   |
| `CONCEPT.md:281` | A - stale claim | P1       | Phase table row `8 (Zukunft) | Multi-Profil` lists multi-profile as a future phase. Shipped 2026-06-02. Carried since 2026-07-01 audit.                                                             | Update the phase table to mark Phase 8 as shipped.                  |
| `CONCEPT.md:293` | A - stale claim | P1       | "Multi-Profil nicht im MVP (aber Datenmodell vorbereitet)" in the non-goals list. The feature is live. Carried since 2026-07-01 audit.                                                             | Remove or rewrite: multi-profile is no longer a non-goal.           |

---

### CLAUDE.md

| File:Line      | Type            | Priority | Reason                                                                                                                                                                                                                                                                                                   | Recommended Action                                                                      |
| -------------- | --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `CLAUDE.md:51` | A - stale claim | P2       | Project structure shows `src/i18n/  # Uebersetzungen (de, en)`. Actual translation JSONs live in `src/locales/de/*.json` / `src/locales/en/*.json`; `src/i18n/` holds only infrastructure (`config.ts`, `detector.ts`, `index.ts`). Carried since 2026-07-01 audit.                                     | Change annotation to "i18n infrastructure (config, detector, index)"; add `src/locales/`. |
| `CLAUDE.md:63` | A - stale claim | P2       | `tailwind.config.ts` listed in the project tree. Tailwind 4 uses CSS-based configuration (`src/index.css` + `@tailwindcss/postcss`); the `.ts` config file does not exist in the repo. Carried since 2026-07-01 audit.                                                                                   | Remove `tailwind.config.ts` from the project tree.                                      |

---

### docs/ROADMAP.md

No new findings. The two recent commits updated ROADMAP correctly: P-16 entry is present and accurate (open only for lawyer pass), the I-11 entry is present, and the ROADMAP correctly omits shipped items per its convention (shipped items go to CHANGELOG).

---

### CHANGELOG.md

No findings. Both recent commits added correct, task-ID-referenced entries under `[Unreleased]`.

---

### docs/decisions/ (ADR completeness)

No new gaps. ADR numbering is sequential (ADR-0001 through ADR-0024) with no gaps. All headers follow the `**Date:** / **Status:**` convention. The two recent commits did not add a new ADR (correctly: P-16 / I-11 required no architectural decision).

---

### docs/manual-smoke/

| File                            | Type                 | Priority | Reason                                                                                                                                                                                                                   | Recommended Action                                              |
| ------------------------------- | -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `p-16-document-row-delete.md`   | A - stale claim      | P2       | Smoke file header reads "Inline document-list delete affordance for /documents (P-16)". The ROADMAP P-16 now covers Impressum / Datenschutz, not document delete. The smoke file's purpose is unclear post-repurposing. File may represent an older distinct scope that was later merged into P-16, or P-16 was reassigned. Either way the task-ID in the filename no longer matches the ROADMAP entry. | Rename the file to remove the misleading P-16 prefix (e.g., `p-inline-doc-delete-smoke.md`) or clarify the task mapping in a file header comment. |
| Naming convention check         | C - stylistic drift  | P3       | `ai-multi-provider.md` lacks a task-ID prefix (e.g., `aip-01-multi-provider.md`) per the naming convention in `docs/manual-smoke/README.md` ("The feature ID matches the ROADMAP task ID"). Minor; the file content is fine. | Rename to match convention when touching the file for another reason. |

---

### docs/audits/

No findings. `current-coverage.md` carries audit date 2026-05-04 and was not archived because no new coverage audit has run since then; the convention requires archival only when a new audit is written. `external-resources-2026-09-16.md` is correctly placed in `docs/audits/` (investigation artifact) per `test-strategy.md`. The `freshness/` subdirectory holds prior freshness reports as expected.

---

### .claude/rules/*.md

No findings. All rule files reviewed: `ai-workflow.md`, `architecture.md`, `code-hygiene.md`, `coding-standards.md`, `lessons-learned.md`, `prioritization.md`, `pr-ci-shepherding.md`, `quality-checks.md`, `release-workflow.md`, `reusability.md`, `task-series.md`, `tdd.md`, `test-strategy.md`. No stale claims against current code or recent git history.

---

## Cross-file consistency

### P-16 task-ID split

Three artifacts use the P-16 task ID with conflicting scopes:

1. `docs/ROADMAP.md` (current definition): Impressum / Datenschutzerklaerung -
   shipped, stays open for lawyer pass.
2. `README.md:225` (stale): "inline document delete (P-16)" - refers to the
   pre-2026-09-16 scope.
3. `docs/manual-smoke/p-16-document-row-delete.md`: smoke file for inline
   document-list delete - also the pre-2026-09-16 scope.

These three cannot all be correct. P-16 was apparently repurposed when the
Impressum work was scheduled (the smoke file predates the I-11/P-16 ROADMAP
update). The inline document delete work may be a separate untracked task, or
it may have been absorbed into the Impressum P-16. Resolution: assign inline
document delete a distinct task ID (e.g., P-17 or P-16b) and update the smoke
file and README accordingly; or confirm the smoke file is for a feature already
shipped under a different task ID and rename it.

### Multi-profile: CONCEPT.md vs ROADMAP vs README

The ROADMAP correctly reflects that M-01..M-05 shipped 2026-06-02. The
CHANGELOG `[Unreleased]` block contains the correct M-series rollup. However,
`docs/CONCEPT.md` (four locations) and `README.md:228` still describe
multi-profile as an MVP non-goal or deferred feature. This three-way
inconsistency has persisted through four commits since the 2026-07-01 audit.

### React version: README vs audit.md vs ROADMAP

README and ROADMAP both correctly reference React 19 (e.g., "React 19
(ADR-0021)" in the Infrastructure bullet). `audit.md:3` is the sole remaining
incorrect source. Low blast radius but high symbolic impact: every automated
audit run from this prompt will report the wrong framework.

---

## Recommended fix batch

**P0 (single-line, 2 minutes)**

| Rank | ID        | File               | Fix                                   |
| ---- | --------- | ------------------ | ------------------------------------- |
| 1    | A1        | `audit.md:3`       | "React 18" -> "React 19"              |

**P1 (four-file sweep, ~30 minutes)**

| Rank | ID        | File                | Fix                                                    |
| ---- | --------- | ------------------- | ------------------------------------------------------ |
| 2    | A4-A7     | `CONCEPT.md:183,267,281,293` | Update four multi-profile MVP/non-goal claims to reflect shipped M-01..M-05 |
| 3    | A2, A3    | `README.md:221,228` | Vite 7->8 and Phase 8 Deferred->Shipped                |

**P2 (README and CLAUDE.md hygiene, ~45 minutes)**

| Rank | ID        | File                      | Fix                                                              |
| ---- | --------- | ------------------------- | ---------------------------------------------------------------- |
| 4    | A8, B3    | `README.md:225` + features | Correct P-16 description; add Impressum/legal and PRIVACY.md entry |
| 5    | B1        | `README.md:231,284`       | Re-run `make test`; update test counts                           |
| 6    | B2        | `README.md` features      | Add multi-profile bullet                                         |
| 7    | A9        | `README.md:53-66`         | Remove broken screenshot blocks                                  |
| 8    | A10-A11   | `CLAUDE.md:51,63`         | Fix i18n annotation and remove tailwind.config.ts                |
| 9    | A8-copy   | `README.md:404-414`       | Rewrite Contributing for post-1.0 Gitflow (ADR-0024)            |

**P3 (cleanup when touching affected files)**

| Rank | ID        | File                                     | Fix                                              |
| ---- | --------- | ---------------------------------------- | ------------------------------------------------ |
| 10   | cross-ref | `docs/manual-smoke/p-16-document-row-delete.md` | Rename file to remove ambiguous P-16 prefix |
| 11   | C         | `docs/manual-smoke/ai-multi-provider.md` | Add task-ID prefix per naming convention         |

---

## Out-of-scope observations

- `docs/audits/current-coverage.md` (dated 2026-05-04) has not been refreshed
  since the coverage audit convention requires archival only when a new run is
  done. No new coverage audit was triggered by the two recent commits. The
  stale date is not a freshness finding under this audit's scope; it is a
  reminder that a new `make test-coverage` pass is overdue.
- `PRIVACY.md` (added 75978c7, corrected f3f9818) correctly references the
  Dexie DB as `phylax` (not `befaro`) per the R-06 deliberate non-rename
  policy. No finding.
- ADR-0024 cross-reference check: all recent commits followed the Gitflow
  branch + PR pattern; no direct-to-main commits detected since ADR-0024
  adoption (2026-06-29). Discipline intact.
