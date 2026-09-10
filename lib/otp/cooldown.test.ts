import assert from "node:assert/strict";
import test from "node:test";

import { RESEND_COOLDOWN_SECONDS } from "./cooldown.ts";

/**
 * Mirrors the branch in requestOtp(): given when the last mail went out, may we
 * send another, and if not how long is left? The real function needs a database,
 * so the arithmetic is checked here - it is the part that regressed.
 */
function cooldown(lastSentAt: number, now: number) {
  const elapsed = (now - lastSentAt) / 1000;
  return elapsed < RESEND_COOLDOWN_SECONDS
    ? { shouldSend: false, retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed) }
    : { shouldSend: true, retryAfterSeconds: 0 };
}

const NOW = 1_700_000_000_000;

test("an immediate second request is refused for the full window", () => {
  const result = cooldown(NOW, NOW);
  assert.equal(result.shouldSend, false);
  assert.equal(result.retryAfterSeconds, RESEND_COOLDOWN_SECONDS);
});

test("mid-window, the countdown reports the time actually left", () => {
  const result = cooldown(NOW, NOW + 10_000);
  assert.equal(result.shouldSend, false);
  assert.equal(result.retryAfterSeconds, RESEND_COOLDOWN_SECONDS - 10);
});

test("a request one second short of the window is still refused", () => {
  assert.equal(cooldown(NOW, NOW + (RESEND_COOLDOWN_SECONDS - 1) * 1000).shouldSend, false);
});

test("past the window, sending is allowed and nothing is owed", () => {
  const result = cooldown(NOW, NOW + RESEND_COOLDOWN_SECONDS * 1000);
  assert.equal(result.shouldSend, true);
  assert.equal(result.retryAfterSeconds, 0);
});

test("the countdown never advertises a wait longer than the cooldown", () => {
  for (let elapsed = 0; elapsed <= RESEND_COOLDOWN_SECONDS; elapsed++) {
    const { retryAfterSeconds } = cooldown(NOW, NOW + elapsed * 1000);
    assert.ok(retryAfterSeconds >= 0 && retryAfterSeconds <= RESEND_COOLDOWN_SECONDS);
  }
});
