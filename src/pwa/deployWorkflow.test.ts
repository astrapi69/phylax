import { describe, it, expect } from 'vitest';
import ciWorkflowSource from '../../.github/workflows/ci.yml?raw';
import deployWorkflowSource from '../../.github/workflows/deploy.yml?raw';

/**
 * I-14 regression guard for the GitHub Pages deployment under Gitflow
 * (ADR-0025).
 *
 * `develop` is the default branch, `main` carries releases. The
 * `github-pages` environment only lets the branch `main` deploy, and
 * GitHub matches that rule against the `GITHUB_REF` of the workflow
 * run. A workflow started by `workflow_run` always has the default
 * branch as its `GITHUB_REF` and its `GITHUB_SHA`, whatever branch the
 * finished run was on. A deployment triggered that way would therefore
 * be refused by the environment, and without that rule it would build
 * `develop` instead of the release.
 *
 * The deployment has to run in the context of the push to `main`. The
 * failure is silent until the next release, so the wiring is pinned
 * here.
 */
describe('GitHub Pages deployment wiring (I-14)', () => {
  it('is triggered by the workflow_run event', () => {
    expect(deployWorkflowSource).toMatch(/^ {2}workflow_run:$/m);
  });

  it('is not called from the CI workflow', () => {
    expect(ciWorkflowSource).not.toContain('./.github/workflows/deploy.yml');
  });
});
