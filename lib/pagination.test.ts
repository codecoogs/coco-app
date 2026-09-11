import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PAGE_SIZE, paginate } from "./pagination.ts";

const items = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test("the default page size is 20", () => {
  assert.equal(DEFAULT_PAGE_SIZE, 20);
  assert.equal(paginate(items(45), 0).pageItems.length, 20);
});

test("the first page shows items 1-20 of the total", () => {
  const result = paginate(items(45), 0);
  assert.deepEqual(result.pageItems, items(20));
  assert.equal(result.from, 1);
  assert.equal(result.to, 20);
  assert.equal(result.total, 45);
  assert.equal(result.pageCount, 3);
});

test("the last page holds only the remainder", () => {
  const result = paginate(items(45), 2);
  assert.deepEqual(result.pageItems, [41, 42, 43, 44, 45]);
  assert.equal(result.from, 41);
  assert.equal(result.to, 45);
});

test("an exact multiple of the page size has no empty trailing page", () => {
  assert.equal(paginate(items(40), 0).pageCount, 2);
});

test("a page past the end clamps to the last page, e.g. after a filter shrinks the list", () => {
  const result = paginate(items(25), 9);
  assert.equal(result.page, 1);
  assert.deepEqual(result.pageItems, [21, 22, 23, 24, 25]);
});

test("a negative page clamps to the first page", () => {
  assert.equal(paginate(items(25), -1).page, 0);
});

test("an empty list is a single empty page", () => {
  const result = paginate([], 0);
  assert.deepEqual(result.pageItems, []);
  assert.equal(result.page, 0);
  assert.equal(result.pageCount, 1);
  assert.equal(result.from, 0);
  assert.equal(result.to, 0);
});
