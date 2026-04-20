import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  estimateStrengthSync,
  strengthFromZxcvbnScore,
  validateSetup,
  MIN_PASSWORD_LENGTH,
} from './passwordValidation';

describe('validatePassword', () => {
  it('rejects empty string', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toEqual({ kind: 'empty' });
    }
  });

  it('rejects password shorter than minimum', () => {
    const result = validatePassword('short');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatchObject({
        kind: 'too-short',
        min: MIN_PASSWORD_LENGTH,
        length: 5,
      });
    }
  });

  it('accepts password at exactly minimum length', () => {
    const result = validatePassword('a'.repeat(MIN_PASSWORD_LENGTH));
    expect(result.valid).toBe(true);
  });

  it('accepts long password with no max limit', () => {
    const result = validatePassword('a'.repeat(50));
    expect(result.valid).toBe(true);
  });

  it('handles Unicode passwords (umlauts, emoji)', () => {
    const password = 'Hallo Welt 🔐🔑';
    const result = validatePassword(password);
    expect(result.valid).toBe(true);
  });

  it('counts code points, not UTF-16 code units', () => {
    const password = 'abcdefghijk🔐';
    expect([...password].length).toBe(12);
    expect(password.length).toBe(13);
    const result = validatePassword(password);
    expect(result.valid).toBe(true);
  });
});

describe('estimateStrengthSync', () => {
  it('returns weak for short passwords', () => {
    expect(estimateStrengthSync('abc')).toBe('weak');
  });

  it('returns fair for 12-char lowercase-only password', () => {
    expect(estimateStrengthSync('abcxyzabcxyz')).toBe('fair');
  });

  it('returns strong for 12-char mixed-class password', () => {
    expect(estimateStrengthSync('Abcdefgh123!')).toBe('strong');
  });

  it('returns strong for 16+ char password', () => {
    expect(estimateStrengthSync('abcdefghijklmnop')).toBe('strong');
  });

  it('drops tier for common pattern (password in string)', () => {
    expect(estimateStrengthSync('password12345678')).toBe('fair');
  });

  it('returns weak for common pattern at short length', () => {
    expect(estimateStrengthSync('password1234')).toBe('weak');
  });

  it('returns weak for qwerty pattern at short length', () => {
    expect(estimateStrengthSync('qwerty123456')).toBe('weak');
  });

  it('returns weak for 123456 pattern at short length', () => {
    expect(estimateStrengthSync('abc123456def')).toBe('weak');
  });
});

describe('strengthFromZxcvbnScore', () => {
  it('maps 0 to weak', () => {
    expect(strengthFromZxcvbnScore(0)).toBe('weak');
  });

  it('maps 1 to weak', () => {
    expect(strengthFromZxcvbnScore(1)).toBe('weak');
  });

  it('maps 2 to fair', () => {
    expect(strengthFromZxcvbnScore(2)).toBe('fair');
  });

  it('maps 3 to strong', () => {
    expect(strengthFromZxcvbnScore(3)).toBe('strong');
  });

  it('maps 4 to strong', () => {
    expect(strengthFromZxcvbnScore(4)).toBe('strong');
  });
});

describe('validateSetup', () => {
  const validPassword = 'a'.repeat(MIN_PASSWORD_LENGTH);

  it('flags empty password', () => {
    const result = validateSetup('', '', false);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toEqual({ kind: 'empty' });
  });

  it('flags too-short password', () => {
    const result = validateSetup('short', 'short', true);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatchObject({ kind: 'too-short' });
    }
  });

  it('flags confirm mismatch', () => {
    const result = validateSetup(validPassword, validPassword + 'x', true);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toEqual({ kind: 'mismatch' });
  });

  it('flags missing acknowledgment', () => {
    const result = validateSetup(validPassword, validPassword, false);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toEqual({ kind: 'not-acknowledged' });
  });

  it('returns valid when all gates pass', () => {
    const result = validateSetup(validPassword, validPassword, true);
    expect(result.valid).toBe(true);
  });

  it('prioritizes password length over mismatch', () => {
    const result = validateSetup('short', 'other', false);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.kind).toBe('too-short');
  });
});
