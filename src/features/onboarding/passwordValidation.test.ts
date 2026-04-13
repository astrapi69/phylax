import { describe, it, expect } from 'vitest';
import { validatePassword, estimateStrength, MIN_PASSWORD_LENGTH } from './passwordValidation';

describe('validatePassword', () => {
  it('rejects empty string', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects password shorter than minimum', () => {
    const result = validatePassword('short');
    expect(result.valid).toBe(false);
    expect(result.error).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it('accepts password at exactly minimum length', () => {
    const result = validatePassword('a'.repeat(MIN_PASSWORD_LENGTH));
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts long password with no max limit', () => {
    const result = validatePassword('a'.repeat(50));
    expect(result.valid).toBe(true);
  });

  it('handles Unicode passwords (umlauts, emoji)', () => {
    // 12 code points: "Pässwörd1234" but with emoji it changes
    const password = 'Hallo Welt 🔐🔑'; // 14 code points
    const result = validatePassword(password);
    expect(result.valid).toBe(true);
  });

  it('counts code points, not UTF-16 code units', () => {
    // Emoji like 🔐 is 1 code point but 2 UTF-16 code units
    // 11 ASCII chars + 1 emoji = 12 code points
    const password = 'abcdefghijk🔐';
    expect([...password].length).toBe(12);
    expect(password.length).toBe(13); // UTF-16 length differs
    const result = validatePassword(password);
    expect(result.valid).toBe(true);
  });
});

describe('estimateStrength', () => {
  it('returns weak for short passwords', () => {
    expect(estimateStrength('abc')).toBe('weak');
  });

  it('returns fair for 12-char lowercase-only password', () => {
    expect(estimateStrength('abcxyzabcxyz')).toBe('fair');
  });

  it('returns strong for 12-char mixed-class password', () => {
    // lowercase + uppercase + digit = 3 classes
    expect(estimateStrength('Abcdefgh123!')).toBe('strong');
  });

  it('returns strong for 16+ char password', () => {
    expect(estimateStrength('abcdefghijklmnop')).toBe('strong');
  });

  it('drops tier for common pattern (password in string)', () => {
    // "password12345678" is 16 chars but contains "password" and "12345"
    expect(estimateStrength('password12345678')).toBe('fair');
  });

  it('returns weak for common pattern at short length', () => {
    expect(estimateStrength('password1234')).toBe('weak');
  });

  it('returns weak for qwerty pattern at short length', () => {
    expect(estimateStrength('qwerty123456')).toBe('weak');
  });

  it('returns weak for 123456 pattern at short length', () => {
    expect(estimateStrength('abc123456def')).toBe('weak');
  });
});
