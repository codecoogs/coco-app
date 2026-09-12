import assert from "node:assert/strict";
import test from "node:test";

import {
  diffChartNodes,
  findLoopedNodeIds,
  layoutChartNodes,
  wouldCreateCycle,
  type ChartNode,
} from "./tree.ts";

function node(id: number, parentId: number | null, title = `P${id}`): ChartNode {
  return { id, title, parentId, x: null, y: null };
}

// President -> VP -> Director -> Officer
const CHAIN: ChartNode[] = [node(1, null, "President"), node(2, 1, "VP"), node(3, 2, "Director"), node(4, 3, "Officer")];

test("a position cannot report to itself", () => {
  assert.equal(wouldCreateCycle(CHAIN, 2, 2), true);
});

test("a position cannot report to one of its own descendants", () => {
  assert.equal(wouldCreateCycle(CHAIN, 1, 4), true);
  assert.equal(wouldCreateCycle(CHAIN, 2, 3), true);
});

test("reporting further up the same chain is allowed", () => {
  assert.equal(wouldCreateCycle(CHAIN, 4, 1), false);
});

test("clearing a parent is always allowed", () => {
  assert.equal(wouldCreateCycle(CHAIN, 2, null), false);
});

test("cycle detection terminates even if the stored data already loops", () => {
  const looped: ChartNode[] = [node(1, 2), node(2, 1)];
  assert.equal(wouldCreateCycle(looped, 1, 2), true);
});

test("layout puts each level on its own row, parents above children", () => {
  const placed = layoutChartNodes(CHAIN);
  const y = (id: number) => placed.find((n) => n.id === id)!.y!;
  assert.ok(y(1) < y(2), "VP sits below the President");
  assert.ok(y(2) < y(3), "Director sits below the VP");
  assert.ok(y(3) < y(4), "Officer sits below the Director");
});

test("siblings are spread out rather than stacked on each other", () => {
  const siblings = [node(1, null), node(2, 1), node(3, 1)];
  const placed = layoutChartNodes(siblings);
  const a = placed.find((n) => n.id === 2)!;
  const b = placed.find((n) => n.id === 3)!;
  assert.equal(a.y, b.y);
  assert.notEqual(a.x, b.x);
});

test("layout keeps coordinates that were already saved", () => {
  const saved: ChartNode[] = [{ id: 1, title: "President", parentId: null, x: 42, y: 99 }];
  const placed = layoutChartNodes(saved);
  assert.equal(placed[0].x, 42);
  assert.equal(placed[0].y, 99);
});

test("a node whose parent chain loops is still placed", () => {
  const looped: ChartNode[] = [node(1, 2), node(2, 1)];
  const placed = layoutChartNodes(looped);
  assert.equal(placed.length, 2);
  assert.ok(placed.every((n) => typeof n.x === "number" && typeof n.y === "number"));
});

test("nothing moved means nothing to save", () => {
  assert.deepEqual(diffChartNodes(CHAIN, CHAIN), []);
});

test("a changed reporting line is reported", () => {
  const after = CHAIN.map((n) => (n.id === 4 ? { ...n, parentId: 1 } : n));
  const changed = diffChartNodes(CHAIN, after);
  assert.equal(changed.length, 1);
  assert.equal(changed[0].id, 4);
  assert.equal(changed[0].parentId, 1);
});

test("a dragged node is reported even when its reporting line is unchanged", () => {
  const after = CHAIN.map((n) => (n.id === 3 ? { ...n, x: 10, y: 20 } : n));
  const changed = diffChartNodes(CHAIN, after);
  assert.deepEqual(changed.map((n) => n.id), [3]);
});

test("a node missing from the new list is not reported as a change", () => {
  const changed = diffChartNodes(CHAIN, CHAIN.filter((n) => n.id !== 4));
  assert.deepEqual(changed, []);
});

test("a clean chart has no loops", () => {
  assert.deepEqual(findLoopedNodeIds(CHAIN), []);
});

test("both members of a two-node loop are reported", () => {
  const looped: ChartNode[] = [node(1, 2), node(2, 1)];
  assert.deepEqual(findLoopedNodeIds(looped).sort(), [1, 2]);
});

test("a longer loop is reported, and clean branches hanging off it are not", () => {
  const looped: ChartNode[] = [node(1, 3), node(2, 1), node(3, 2), node(4, null), node(5, 4)];
  assert.deepEqual(findLoopedNodeIds(looped).sort(), [1, 2, 3]);
});

test("a position pointing at itself is a loop", () => {
  assert.deepEqual(findLoopedNodeIds([node(1, 1)]), [1]);
});
