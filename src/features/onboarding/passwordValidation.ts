export const MIN_PASSWORD_LENGTH = 12;

export type PasswordStrength = 'weak' | 'fair' | 'strong';

/**
 * Discriminated validation error. The UI layer resolves these to user-facing
 * strings via i18next so this module stays pure TypeScript without a
 * framework dependency.
 */
export type ValidationError =
  | { kind: 'empty' }
  | { kind: 'too-short'; min: number; length: number };

export type ValidationResult = { valid: true } | { valid: false; error: ValidationError };

/**
 * Setup-flow validation error. Covers the full submit gate: password
 * validity, confirm match, and warning acknowledgment.
 */
export type SetupValidationError =
  | { kind: 'empty' }
  | { kind: 'too-short'; min: number; length: number }
  | { kind: 'mismatch' }
  | { kind: 'not-acknowledged' };

export type SetupValidationResult = { valid: true } | { valid: false; error: SetupValidationError };

const COMMON_PATTERNS = ['password', '123456', 'qwerty', 'letmein', 'welcome'];

/**
 * Validate a master password against minimum requirements.
 * Only hard gate is minimum length. No character class requirements.
 *
 * @param password - the password to validate
 * @returns valid true, or valid false with a typed ValidationError
 */
export function validatePassword(password: string): ValidationResult {
  // Use code point length for accurate Unicode handling.
  // [...str].length counts code points, not UTF-16 code units.
  const length = [...password].length;

  if (length === 0) {
    return { valid: false, error: { kind: 'empty' } };
  }

  if (length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: { kind: 'too-short', min: MIN_PASSWORD_LENGTH, length },
    };
  }

  return { valid: true };
}

/**
 * Synchronous heuristic strength estimate. Serves as fallback while
 * the zxcvbn bundle lazy-loads, and as final fallback if the lazy
 * import fails. Informative only, does not block submission.
 *
 * Tiers:
 * - weak (red): length < 12, or common pattern detected at length < 16
 * - fair (yellow): length 12-15 with low variety
 * - strong (green): length 16+ or length 12+ with mixed character classes
 *
 * Character variety: presence of lowercase, uppercase, digits, special chars.
 * Mixed = 3+ of these 4 classes.
 */
export function estimateStrengthSync(password: string): PasswordStrength {
  const codePoints = [...password];
  const length = codePoints.length;

  if (length < MIN_PASSWORD_LENGTH) {
    return 'weak';
  }

  const hasCommonPattern = containsCommonPattern(password);
  const variety = countCharacterClasses(password);
  const isMixed = variety >= 3;

  if (hasCommonPattern && length < 16) {
    return 'weak';
  }

  if (length >= 16 || isMixed) {
    return hasCommonPattern ? 'fair' : 'strong';
  }

  return 'fair';
}

/**
 * Map a zxcvbn-ts 0-4 score to the UI tier.
 * - 0-1: weak (trivially guessable)
 * - 2: fair (guessable by targeted attacker)
 * - 3-4: strong (resistant to offline attack with slow hash)
 */
export function strengthFromZxcvbnScore(score: number): PasswordStrength {
  if (score <= 1) return 'weak';
  if (score === 2) return 'fair';
  return 'strong';
}

/**
 * Combined submit-gate validator. Returns the first blocking error in
 * priority order: password length -> confirm match -> acknowledgment.
 * Strength is advisory and does not block.
 */
export function validateSetup(
  password: string,
  confirmPassword: string,
  acknowledged: boolean,
): SetupValidationResult {
  const passwordResult = validatePassword(password);
  if (!passwordResult.valid) {
    return { valid: false, error: passwordResult.error };
  }

  if (password !== confirmPassword) {
    return { valid: false, error: { kind: 'mismatch' } };
  }

  if (!acknowledged) {
    return { valid: false, error: { kind: 'not-acknowledged' } };
  }

  return { valid: true };
}

function containsCommonPattern(password: string): boolean {
  const lower = password.toLowerCase();
  return COMMON_PATTERNS.some((pattern) => lower.includes(pattern));
}

function countCharacterClasses(password: string): number {
  let classes = 0;
  if (/[a-z]/.test(password)) classes++;
  if (/[A-Z]/.test(password)) classes++;
  if (/[0-9]/.test(password)) classes++;
  if (/[^a-zA-Z0-9]/.test(password)) classes++;
  return classes;
}
