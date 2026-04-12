import { describe, it, expect } from 'vitest';

describe('vitest sanity check', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('handles string matching', () => {
    expect('phylax').toContain('phyla');
  });
});
