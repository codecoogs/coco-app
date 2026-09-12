import assert from "node:assert/strict";
import test from "node:test";

import { MIN_RANK_GAP, RANK_STEP, rankBetween, rebalanceRanks } from "./rank.ts";

test("the first card in an empty column gets the step as its rank", () => {
  assert.equal(rankBetween(null, null), RANK_STEP);
});

test("dropping at the end goes one step past the last card", () => {
  assert.equal(rankBetween(3000, null), 4000);
});

test("dropping at the top goes one step before the first card", () => {
  assert.equal(rankBetween(null, 1000), 0);
});

test("dropping between two cards lands halfway, leaving both untouched", () => {
  assert.equal(rankBetween(1000, 2000), 1500);
});

test("repeated drops into the same gap keep producing distinct ranks", () => {
  let low = 1000;
  const high = 2000;
  const seen = new Set<number>();
  for (let i = 0; i < 20; i++) {
    const next = rankBetween(low, high);
    assert.ok(next > low && next < high, `rank ${next} escaped the gap`);
    assert.ok(!seen.has(next), "rank repeated");
    seen.add(next);
    low = next;
  }
});

test("a gap that has become too small to split is reported", () => {
  assert.equal(rebalanceRanks([1, 2, 3]).length, 3);
  const tight = [1, 1 + MIN_RANK_GAP / 4];
  assert.deepEqual(rebalanceRanks(tight), [RANK_STEP, RANK_STEP * 2]);
});

test("rebalancing spaces every card evenly and keeps their order", () => {
  assert.deepEqual(rebalanceRanks([5, 10, 15]), [1000, 2000, 3000]);
});

test("rebalancing an empty column is a no-op", () => {
  assert.deepEqual(rebalanceRanks([]), []);
});
