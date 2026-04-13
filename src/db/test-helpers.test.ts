import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, getLockState } from '../crypto';
import { metaExists } from './meta';
import { resetDatabase, setupCompletedOnboarding } from './test-helpers';

beforeEach(async () => {
  lock();
  await resetDatabase();
});

describe('setupCompletedOnboarding', () => {
  it('creates meta row', async () => {
    await setupCompletedOnboarding('test-password-12');
    expect(await metaExists()).toBe(true);
  });

  it('leaves keyStore locked', async () => {
    await setupCompletedOnboarding('test-password-12');
    expect(getLockState()).toBe('locked');
  });

  it('can be called twice (resets and re-creates)', async () => {
    await setupCompletedOnboarding('password-one-12');
    await setupCompletedOnboarding('password-two-12');
    expect(await metaExists()).toBe(true);
    expect(getLockState()).toBe('locked');
  });
});
