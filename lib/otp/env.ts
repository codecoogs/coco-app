/**
 * How long an OTP code stays valid for, in minutes. Configurable via
 * OTP_EXPIRY_MINUTES; falls back to 15 if unset or invalid.
 */
export function getOtpExpiryMinutes(): number {
  const raw = process.env.OTP_EXPIRY_MINUTES;
  if (!raw) return 15;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 15;
}
