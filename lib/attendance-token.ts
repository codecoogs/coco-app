/**
 * Rotating check-in tokens for the event QR code.
 *
 * The QR encodes a token that is only valid for a 15-second window, so a photo
 * of the screen sent to someone who is not at the event is worthless by the
 * time they open it. The token is an HMAC over (eventId, windowIndex) - nothing
 * is stored, so there is no table to clean up and no state to keep in sync.
 *
 * Verification accepts the previous window too: a scan that starts at 14.9s
 * would otherwise fail while the camera focuses. That doubles the sharing
 * window to at most 30s, which is the price of not rejecting honest scans.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** ponytail: 15s fits a projector refresh; shorten if sharing is observed. */
export const WINDOW_MS = 15_000;

function secret(): string {
  const value = process.env.ATTENDANCE_QR_SECRET;
  if (!value) {
    throw new Error("ATTENDANCE_QR_SECRET is not set");
  }
  return value;
}

export function windowIndexAt(now: number = Date.now()): number {
  return Math.floor(now / WINDOW_MS);
}

/** Milliseconds until the current window rolls over - drives the client timer. */
export function msUntilNextWindow(now: number = Date.now()): number {
  return WINDOW_MS - (now % WINDOW_MS);
}

function sign(eventId: number, index: number): string {
  return createHmac("sha256", secret())
    .update(`${eventId}.${index}`)
    .digest("base64url");
}

export function createCheckInToken(
  eventId: number,
  now: number = Date.now()
): string {
  const index = windowIndexAt(now);
  return `${index}.${sign(eventId, index)}`;
}

function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, which is itself a leak-free
  // "not equal" - but it has to be checked first or it throws instead.
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyCheckInToken(
  eventId: number,
  token: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!token) return false;

  const separator = token.indexOf(".");
  if (separator <= 0) return false;

  const index = Number(token.slice(0, separator));
  const signature = token.slice(separator + 1);
  if (!Number.isInteger(index) || !signature) return false;

  const current = windowIndexAt(now);
  if (index !== current && index !== current - 1) return false;

  return signaturesMatch(signature, sign(eventId, index));
}
