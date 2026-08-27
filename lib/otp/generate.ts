import { randomInt } from "crypto";

/** Cryptographically random 6-digit code, zero-padded (e.g. "042917"). */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
