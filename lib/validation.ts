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

const MAX_NAME_LENGTH = 100;

/**
 * First/last name: required non-empty after trim, length cap, no dangerous patterns.
 */
export function validatePersonName(
  value: string,
  label: string
): { valid: boolean; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, error: `${label} is required.` };
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `${label} is too long.` };
  }
  if (DANGEROUS_PATTERN.test(trimmed)) {
    return { valid: false, error: `${label} contains invalid characters.` };
  }
  return { valid: true };
}

/** Full value: year + month 01–09 (leading 0) or 10–12. */
const GRADUATION_REGEX = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * Builds display string YYYY-MM from user input: only digits (and ignored separators);
 * month must use two digits (01–12, never a single digit for month).
 */
export function sanitizeExpectedGraduationInput(input: string): string {
  let digits = input.replace(/\D/g, "").slice(0, 6);
  const y = digits.slice(0, 4);
  let ms = digits.slice(4);

  while (ms.length > 0 && ms[0] !== "0" && ms[0] !== "1") {
    ms = ms.slice(1);
  }

  let m = "";
  if (ms.length >= 1) {
    m = ms[0];
    if (ms.length >= 2) {
      const d1 = ms[1];
      if (m === "0" && "123456789".includes(d1)) m += d1;
      else if (m === "1" && "012".includes(d1)) m += d1;
    }
  }

  if (y.length < 4) return y;
  if (m.length === 0) return `${y}-`;
  return `${y}-${m}`;
}

/**
 * Expected graduation as YYYY-MM (months 01–12, two-digit month required).
 */
export function validateExpectedGraduation(value: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, error: "Expected graduation is required." };
  }
  if (!GRADUATION_REGEX.test(trimmed)) {
    return {
      valid: false,
      error:
        "Use YYYY-MM with a two-digit month (01–09, 10–12), e.g. 2026-05.",
    };
  }
  if (DANGEROUS_PATTERN.test(trimmed)) {
    return { valid: false, error: "Invalid value." };
  }
  return { valid: true };
}
