# ADR-0025: Gitflow with a `develop` integration branch

**Date:** 2026-11-24
**Status:** Accepted

Amends [ADR-0024](ADR-0024-gitflow-feature-branches.md): its decision
points 1 and 5 are replaced, points 2, 3, 4, 6 and 7 stay in force with
`develop` in the place of `main`.

## Context

ADR-0024 introduced per-task branches and a CI-gated pull request, but
every pull request targeted `main`. That is a feature-branch workflow
with one trunk, not Gitflow: there is no integration branch, so `main`
is at once the place where work accumulates and the place releases are
cut from.

Two consequences, measured in this repository on 2026-11-24:

- `.github/workflows/deploy.yml` deploys GitHub Pages after every green
  CI run on `main` (its trigger is `workflow_run` of `CI`, `types:
[completed]`, `branches: [main]`). Each task merged into `main`, so
  each merged task went live, released or not: the deployment run
  45399433855 (started 13:02:58 UTC) published commit `365f9c4`, which
  is 120 commits after the last tag `v1.1.0`
  (`git rev-list --count v1.1.0..365f9c4`).
- A release had no branch of its own. `.claude/rules/release-workflow.md`
  put the release commit on a `chore/release-vX.Y.Z` branch against
  `main`, the same branch that received the task pull requests.

Five other repositories of the family have `develop` as their default
branch: bibliogon, lethenon, mystic-crypt-ui, crypt-api and
adaptive-learner (`gh api repos/astrapi69/<repo> -q .default_branch`,
2026-11-24).

The maintainer decided on 2026-11-24 to introduce Gitflow in this
repository.

### Rejected alternatives

- **Keep the single trunk (ADR-0024 as it is).** Rejected: unreleased
  work keeps going live with every merge, and the repository stays the
  odd one out in the family.
- **Keep the single trunk and gate the deployment on tags instead.**
  Solves the deployment half only. Release stabilisation and hotfixes
  would still share one branch with ongoing feature work.

## Decision

1. **Two long-lived branches.** `develop` is the integration branch and
   GitHub's default branch. `main` carries releases and hotfixes only.
   No direct commit to either.
2. **Task branches come from `develop` and go back to `develop`.**
   Branch naming is unchanged (ADR-0024 point 3). The pull request
   targets `develop`; CI must be green before the merge (ADR-0024
   point 2).
3. **Squash stays the default for task pull requests into `develop`**
   (ADR-0024 point 4): one commit per task on `develop`.
4. **A release is a branch.** `release/vX.Y.Z` is cut from `develop`,
   carries the version bump and the CHANGELOG section, and is merged
   into `main` through a pull request with green CI. That merge is a
   merge commit, never a squash, so `main` and `develop` keep a common
   history. The tag is set on `main`. Afterwards `main` is merged back
   into `develop`, again as a merge commit.
5. **A hotfix branches from `main`** as `fix/<BUG-NN>-desc`, goes into
   `main` through a pull request with green CI, and `main` is merged
   back into `develop` afterwards. This replaces ADR-0024 point 5. The
   CI-green gate has no bypass.
6. **Deployment follows `main`.** The deployment runs after a green CI
   run on a push to `main`. With decision 1 that means the live site
   changes with a release or a hotfix, no longer with every merged
   task. `deploy.yml` is called by `ci.yml` as its last job
   (`workflow_call`), no longer started by `workflow_run`: see
   "Deployment trigger" below.
7. **CI runs on both branches.** `ci.yml` triggers on pushes to and
   pull requests against `main` and `develop`. The nightly mutation
   workflow (`mutation-nightly.yml`) has a `schedule` trigger. GitHub
   documents for that event: "Scheduled workflows will only run on the
   default branch." It therefore runs on `develop` once `develop` is
   the default branch.
8. **Agent auto-merge for documentation-only pull requests** (ADR-0024
   point 7) applies to pull requests into `develop`. A release or
   hotfix pull request into `main` is never merged by the agent.

### Deployment trigger

The first version of this ADR said `deploy.yml` stays as it is. That
was wrong. `deploy.yml` was started by `workflow_run`, and GitHub
documents for that event `GITHUB_SHA` "Last commit on default branch"
and `GITHUB_REF` "Default branch". With `develop` as the default
branch two things follow:

- The `github-pages` environment has one deployment branch rule, `main`
  (measured 2026-11-24:
  `gh api repos/astrapi69/phylax/environments/github-pages/deployment-branch-policies`).
  GitHub documents: "The deployment branch or tag rule is matched
  against the `GITHUB_REF` of the workflow run." A run with `develop`
  as its `GITHUB_REF` does not match the rule.
- The checkout step had no `ref`, so it would have built the default
  branch, not the commit that passed CI on `main`.

Neither was observed in a run: the trigger was replaced before a
deployment ran with `develop` as the default branch. The statement
rests on the two documented rules above.

`deploy.yml` is now a called workflow. GitHub documents: "When a
reusable workflow is triggered by a caller workflow, the `github`
context is always associated with the caller workflow." The caller is
the CI run of the push to `main`, so `GITHUB_REF` is `main` and the
checkout takes the pushed commit. The calling job needs every gate job
and runs only on a push to `main`. The environment rule stays as it
is. `src/pwa/deployWorkflow.test.ts` pins the wiring.

## Consequences

- Users of the deployed app get changes with a release, not with each
  merge. A fix that must reach them at once takes the hotfix path.
- `develop` can be ahead of what is live. The version shown in the app
  and the CHANGELOG section of the last tag describe the live state
  again.
- One more branch to keep in sync: every merge into `main` is followed
  by a merge of `main` into `develop`. Forgetting it shows as a
  `main` that is ahead of `develop`.
- The repository has no `.github/dependabot.yml`; its Dependabot pull
  requests are security updates. GitHub documents: "security updates
  always use the default branch for the repository". They target
  `develop` once `develop` is the default branch.
- One step is a repository setting and not part of a commit: making
  `develop` the default branch.
- `develop` was created from `main` at commit `f116658`.

## Sources

The two GitHub Docs quotes were read verbatim on 2026-11-24 in the
source of the documentation, repository `github/docs` at commit
`801373e82d`.

- Vincent Driessen, "A successful Git branching model" (2010), the
  definition of the model: <https://nvie.com/posts/a-successful-git-branching-model/>
- GitHub Docs, "Events that trigger workflows", section `schedule`
  (`content/actions/reference/workflows-and-actions/events-that-trigger-workflows.md`):
  "Scheduled workflows will only run on the default branch."
  <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule>
- GitHub Docs, Dependabot options reference, section `target-branch`
  (`content/code-security/reference/supply-chain-security/dependabot-options-reference.md`):
  "Options defined for this `package-ecosystem` no longer apply to
  security updates because security updates always use the default
  branch for the repository."
  <https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#target-branch>
