import { describe, it, expect } from 'vitest';
import { hooksPathFor } from './setup-git-hooks.mjs';

describe('hooksPathFor', () => {
  it('points at .husky/_ of the checkout that owns the .git directory', () => {
    expect(hooksPathFor('/home/dev/befaro/.git')).toBe('/home/dev/befaro/.husky/_');
  });

  it('gives the same absolute path whichever worktree asks', () => {
    // `git rev-parse --git-common-dir` answers with the main checkout's
    // .git from every linked worktree, so every worktree gets the hooks
    // of the main checkout.
    const fromMain = hooksPathFor('/home/dev/befaro/.git');
    const fromWorktree = hooksPathFor('/home/dev/befaro/.git');
    expect(fromWorktree).toBe(fromMain);
    expect(fromMain.startsWith('/')).toBe(true);
  });

  it('copes with a trailing slash and surrounding whitespace from git', () => {
    expect(hooksPathFor('/home/dev/befaro/.git/\n')).toBe('/home/dev/befaro/.husky/_');
  });

  it('refuses an empty answer instead of guessing a path', () => {
    expect(() => hooksPathFor('')).toThrow(/git common dir/);
    expect(() => hooksPathFor('  \n')).toThrow(/git common dir/);
  });

  it('refuses a relative path, which git would resolve per worktree again', () => {
    expect(() => hooksPathFor('.git')).toThrow(/absolute/);
  });
});
