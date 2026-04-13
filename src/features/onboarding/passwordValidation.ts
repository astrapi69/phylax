export const MIN_PASSWORD_LENGTH = 12;

export type PasswordStrength = 'weak' | 'fair' | 'strong';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const COMMON_PATTERNS = ['password', '123456', 'qwerty', 'letmein', 'welcome'];

/**
 * Validate a master password against minimum requirements.
 * Only hard gate is minimum length. No character class requirements.
 *
 * @param password - the password to validate
 * @returns valid + optional error message
 */
export function validatePassword(password: string): ValidationResult {
  // Use code point length for accurate Unicode handling.
  // [...str].length counts code points, not UTF-16 code units.
  const length = [...password].length;

  if (length === 0) {
    return { valid: false, error: 'Bitte ein Passwort eingeben.' };
  }

  if (length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen erforderlich (aktuell: ${length}).`,
    };
  }

  return { valid: true };
}

/**
 * Estimate password strength for the UI indicator.
 * Informative only, does not block submission.
 *
 * Tiers:
 * - weak (red): length < 12, or common pattern detected at length < 16
 * - fair (yellow): length 12-15 with low variety
 * - strong (green): length 16+ or length 12+ with mixed character classes
 *
 * Character variety: presence of lowercase, uppercase, digits, special chars.
 * Mixed = 3+ of these 4 classes.
 */
export function estimateStrength(password: string): PasswordStrength {
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
