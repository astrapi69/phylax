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

Two consequences are measurable in this repository on 2026-11-24:

- `.github/workflows/deploy.yml` deploys GitHub Pages after every green
  CI run on `main`. Since each task merges into `main`, every merged
  task goes live at once, released or not. The live site carries
  everything under `[Unreleased]` in `CHANGELOG.md`, while the last tag
  is `v1.1.0`.
- A release has no branch of its own to stabilise on. The release
  commit is one more task branch against the same trunk that keeps
  receiving feature work.

The other repositories of the family that are developed actively
(bibliogon, lethenon, mystic-crypt-ui and its libraries) already work
with `develop` as the integration branch and `main` or `master` for
releases. Phylax was the exception, which also made every cross-repo
instruction ("PR against develop") wrong here.

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
6. **Deployment follows `main`.** `deploy.yml` stays as it is: it
   deploys after a green CI run on `main`. With decision 1 that means
   the live site changes with a release or a hotfix, no longer with
   every merged task.
7. **CI runs on both branches.** `ci.yml` triggers on pushes to and
   pull requests against `main` and `develop`. The nightly mutation
   workflow has a `schedule` trigger and therefore runs on the default
   branch, which is `develop` after the switch.
8. **Agent auto-merge for documentation-only pull requests** (ADR-0024
   point 7) applies to pull requests into `develop`. A release or
   hotfix pull request into `main` is never merged by the agent.

## Consequences

- Users of the deployed app get changes with a release, not with each
  merge. A fix that must reach them at once takes the hotfix path.
- `develop` can be ahead of what is live. The version shown in the app
  and the CHANGELOG section of the last tag describe the live state
  again.
- One more branch to keep in sync: every merge into `main` is followed
  by a merge of `main` into `develop`. Forgetting it shows as a
  `main` that is ahead of `develop`.
- Dependabot opens its pull requests against the default branch, so
  they target `develop` after the switch.
- Two steps are repository settings and not part of the commit that
  adds this ADR: making `develop` the default branch, and retargeting
  the pull requests that were open against `main` at the time.
- `main` and `develop` start from the same commit (`f116658`), so the
  first release merge is a plain merge without conflicts.

## Sources

- Vincent Driessen, "A successful Git branching model" (2010), the
  definition of the model: <https://nvie.com/posts/a-successful-git-branching-model/>
- GitHub Docs, "Events that trigger workflows", `schedule`: scheduled
  workflows run on the latest commit of the default branch:
  <https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule>
- GitHub Docs, Dependabot options reference, `target-branch`: without
  it, Dependabot uses the default branch:
  <https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference#target-branch>
