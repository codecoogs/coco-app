/**
 * Centralized input validation for auth forms.
 * Rejects characters and patterns commonly used in SQL injection and other attacks,
 * while allowing normal email and password input.
 */

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 256;
const DEFAULT_MIN_PASSWORD_LENGTH = 6;

/** Characters/sequences that suggest SQL injection or dangerous input */
const DANGEROUS_PATTERN = /['"`;\\]|--|\/\*|\*\/|\\x[0-9a-fA-F]{2}|(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE)\b)/i;

/**
 * Safe email format: local@domain.tld
 * Allows letters, numbers, . _ % + - in local part; letters, numbers, . - in domain.
 */
const SAFE_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Validates email for login/signup. Rejects empty, too long, invalid format,
 * and strings containing characters or patterns used in SQL injection.
 */
export function validateEmail(email: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = email.trim();
  if (!trimmed) {
    return { valid: false, error: "Email is required." };
  }
  if (trimmed.length > MAX_EMAIL_LENGTH) {
    return { valid: false, error: "Email is too long." };
  }
  if (DANGEROUS_PATTERN.test(trimmed)) {
    return { valid: false, error: "Email contains invalid characters." };
  }
  // Normalize: remove spaces for regex check (we already trimmed)
  const normalized = trimmed.replace(/\s+/g, "");
  if (!SAFE_EMAIL_REGEX.test(normalized)) {
    return { valid: false, error: "Please enter a valid email address." };
  }
  return { valid: true };
}

/**
 * Validates password for signup/reset/sign-in. Rejects empty, too short, too long,
 * and strings containing characters or patterns used in SQL injection.
 */
export function validatePassword(
  password: string,
  options: { minLength?: number } = {}
): { valid: boolean; error?: string } {
  const minLength = options.minLength ?? DEFAULT_MIN_PASSWORD_LENGTH;
  if (!password) {
    return { valid: false, error: "Password is required." };
  }
  if (password.length < minLength) {
    return {
      valid: false,
      error: `Password must be at least ${minLength} characters.`,
    };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: "Password is too long." };
  }
  if (DANGEROUS_PATTERN.test(password)) {
    return { valid: false, error: "Password contains invalid characters." };
  }
  return { valid: true };
}
