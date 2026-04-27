import { describe, it, expect } from 'vitest';
import { bumpVersion } from './bumpVersion';

describe('bumpVersion', () => {
  it('increments the last numeric component of a dotted version', () => {
    expect(bumpVersion('1.3.1')).toBe('1.3.2');
    expect(bumpVersion('1.0')).toBe('1.1');
    expect(bumpVersion('2.9.99')).toBe('2.9.100');
  });

  it('appends -ai1 when the version has no trailing numeric component', () => {
    expect(bumpVersion('custom')).toBe('custom-ai1');
    expect(bumpVersion('')).toBe('0-ai1');
  });

  it('increments an existing -aiN suffix instead of stacking suffixes', () => {
    expect(bumpVersion('custom-ai1')).toBe('custom-ai2');
    expect(bumpVersion('1.3.1-ai5')).toBe('1.3.1-ai6');
  });

  it('trims whitespace before parsing', () => {
    expect(bumpVersion('  1.3.1  ')).toBe('1.3.2');
  });
});
