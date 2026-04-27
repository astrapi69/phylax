# Phylax Maintenance Notes

Operational notes for maintainers. Not user-facing. Lives alongside
`ROADMAP.md` and the ADRs in `decisions/`.

## User documentation lives in a separate repository

User-facing documentation is at https://github.com/astrapi69/phylax-docs
and deploys to https://astrapi69.github.io/phylax-docs/.

### Why a separate repo

The Phylax PWA owns `astrapi69.github.io/phylax/` (set via `vite.config.ts`
`base: '/phylax/'`). Hosting docs at a subpath of the same Pages site
would conflict with the service worker scope and require merging two
build artifacts into one Pages upload. The separate-repo split keeps
both deploy pipelines independent: doc changes never trigger a PWA
rebuild, and a PWA breakage never blocks doc updates.

Bibliogon (the MkDocs setup that Phylax docs were templated from) does
not have this conflict because Bibliogon is a Tauri/desktop app with
no web deployment competing for the subpath. Phylax's PWA constraint
is the load-bearing reason for the split.

### Glossary sync discipline

The canonical glossary lives in this repo at
[docs/i18n-glossary.md](i18n-glossary.md). The doc site mirrors
relevant terms in its own `glossary.md` page but does NOT duplicate
the file or import it via tooling.

Sync is a manual review-checklist discipline:

1. When app strings change in `src/locales/de/*.json` or `en/*.json`,
   update `docs/i18n-glossary.md` in the same PR.
2. When `docs/i18n-glossary.md` changes, open a corresponding doc-site
   PR in `phylax-docs` updating any pages that use the affected term.
3. Doc-site PRs link back to the Phylax PR that triggered them.

Code-enforced glossary sync (e.g., a CI step that compares term lists)
is intentionally out of scope. The cost of solo-maintainer review
exceeds the cost of occasional drift; the review hook lives in the PR
template.

### Cross-repo tick discipline

ROADMAP tracks DOC-series tasks in this repo. Implementation lands in
`phylax-docs`. The two never share a commit, so the ROADMAP tick is
its own follow-up commit in this repo after the corresponding
`phylax-docs` commit lands and CI is green.

Pattern per content batch:

1. Implementation commit in `phylax-docs/main` (e.g., DOC-01b: Getting
   Started topics). CI deploys to https://astrapi69.github.io/phylax-docs/.
2. Manual smoke verifies the deployed pages render and link correctly.
3. Follow-up commit in this repo updates ROADMAP — ticks the relevant
   DOC-01x sub-bullet, references the `phylax-docs` commit hash in the
   commit message body for cross-repo traceability.

This avoids stale ROADMAP entries (work shipped but un-ticked) and keeps
each repo's commit log focused on its own concerns.

### Doc-site update cadence

Per the exploration document (`docs/explorations/exploration-user-documentation.md`):

- **Phase-triggered, not commit-triggered.** When a Phylax phase
  closes, the affected doc pages get reviewed. Per-commit doc churn
  burns out solo maintainers.
- **High self-explanation threshold.** If a feature is intuitive
  enough that no doc is needed, no doc gets written. Better no docs
  than outdated docs.

### Build-from-source equivalence

Both repos are MIT-licensed. Both use Conventional Commits. Both
deploy via GitHub Pages with `permissions: pages: write, id-token: write`.

The doc-site CI is independent: pushes to `phylax-docs/main` trigger
its own build + deploy workflow. The Phylax CI workflow chain (CI ->
Deploy to GitHub Pages) is unrelated and unchanged.

## Other operational notes

(Add as the project surfaces them.)
