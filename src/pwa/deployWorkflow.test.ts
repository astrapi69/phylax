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
 * The deployment has to run in the context of the push to `main`: as a
 * job of the CI workflow that calls `deploy.yml`. The failure is silent
 * until the next release, so the wiring is pinned here.
 */

/** The text of the `deploy` job in ci.yml, up to the end of the file. */
function deployJobOf(ciSource: string): string {
  const start = ciSource.indexOf('\n  deploy:\n');
  return start === -1 ? '' : ciSource.slice(start);
}

describe('GitHub Pages deployment wiring (I-14)', () => {
  it('is not triggered by the workflow_run event', () => {
    expect(deployWorkflowSource).not.toMatch(/^\s*workflow_run:/m);
  });

  it('can be called by another workflow and dispatched by hand', () => {
    expect(deployWorkflowSource).toMatch(/^ {2}workflow_call:$/m);
    expect(deployWorkflowSource).toMatch(/^ {2}workflow_dispatch:$/m);
  });

  it('is called from the CI workflow', () => {
    expect(deployJobOf(ciWorkflowSource)).toContain('uses: ./.github/workflows/deploy.yml');
  });

  it('runs only on a push to main', () => {
    expect(deployJobOf(ciWorkflowSource)).toContain(
      "if: github.event_name == 'push' && github.ref == 'refs/heads/main'",
    );
  });

  it('waits for every gate job of the CI workflow', () => {
    const jobsSection = ciWorkflowSource.slice(ciWorkflowSource.indexOf('\njobs:\n'));
    const gateJobs = [...jobsSection.matchAll(/^ {2}([a-z0-9-]+):$/gm)]
      .map((match) => match[1])
      .filter((job) => job !== 'deploy');
    const needs = /needs: \[([^\]]*)\]/.exec(deployJobOf(ciWorkflowSource))?.[1] ?? '';
    const needed = needs.split(',').map((job) => job.trim());

    expect(gateJobs.length).toBeGreaterThanOrEqual(5);
    expect(needed.sort()).toEqual([...gateJobs].sort());
  });
});
