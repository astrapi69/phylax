#!/usr/bin/env node
/**
 * Second half of the `prepare` script, after `husky`.
 *
 * husky sets `core.hooksPath` to the relative `.husky/_`. Git resolves a
 * relative hooks path against the root of whichever worktree commits,
 * and `.husky/_` is generated and git-ignored, so a linked worktree that
 * never ran `npm ci` has none: its commits ran no hook at all, silently
 * (TD-25).
 *
 * This script replaces the relative path by the absolute path of the
 * main checkout's `.husky/_`. The setting lives in the shared
 * `.git/config`, so every worktree then runs the same hook. The hook
 * itself (`.husky/pre-commit`) refuses to run without `node_modules`,
 * so a worktree that cannot run the checks fails loudly.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The hooks directory for a repository, given the output of
 * `git rev-parse --path-format=absolute --git-common-dir`.
 *
 * @param {string} gitCommonDir absolute path of the shared `.git` directory
 * @returns {string} absolute path of `.husky/_` in the main checkout
 */
export function hooksPathFor(gitCommonDir) {
  const commonDir = gitCommonDir.trim();
  if (commonDir === '') {
    throw new Error('git common dir is empty');
  }
  if (!path.isAbsolute(commonDir)) {
    throw new Error(`git common dir must be absolute, got "${commonDir}"`);
  }
  return path.resolve(commonDir, '..', '.husky', '_');
}

function main() {
  if (process.env.HUSKY === '0') return;
  let commonDir;
  try {
    commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // Not a git checkout (an install from a tarball): no hooks to set.
    return;
  }
  execFileSync('git', ['config', 'core.hooksPath', hooksPathFor(commonDir)], { stdio: 'inherit' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
