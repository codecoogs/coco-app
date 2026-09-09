import assert from "node:assert/strict";
import test from "node:test";

process.env.ATTENDANCE_QR_SECRET = "test-secret";

const { createCheckInToken, verifyCheckInToken, WINDOW_MS, msUntilNextWindow } =
  await import("./attendance-token.ts");

const NOW = 1_000_000_000_000;

test("a fresh token verifies", () => {
  assert.equal(verifyCheckInToken(42, createCheckInToken(42, NOW), NOW), true);
});

test("still valid one window later, dead two windows later", () => {
  const token = createCheckInToken(42, NOW);
  assert.equal(verifyCheckInToken(42, token, NOW + WINDOW_MS), true);
  assert.equal(verifyCheckInToken(42, token, NOW + WINDOW_MS * 2), false);
});

test("a token for one event does not check in to another", () => {
  assert.equal(verifyCheckInToken(43, createCheckInToken(42, NOW), NOW), false);
});

test("tampering and junk are rejected", () => {
  const token = createCheckInToken(42, NOW);
  const [index] = token.split(".");
  assert.equal(verifyCheckInToken(42, `${index}.forged`, NOW), false);
  assert.equal(verifyCheckInToken(42, "nonsense", NOW), false);
  assert.equal(verifyCheckInToken(42, "", NOW), false);
  assert.equal(verifyCheckInToken(42, null, NOW), false);
});

test("countdown stays inside the window", () => {
  assert.equal(msUntilNextWindow(NOW), WINDOW_MS - (NOW % WINDOW_MS));
  assert.ok(msUntilNextWindow(NOW + 1) > 0);
});
