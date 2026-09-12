import assert from "node:assert/strict";
import test from "node:test";

import { groupDigestTasks, renderTaskDigestEmail, type DigestTask } from "./task-digest.ts";

const SUNDAY = new Date("2026-09-13T13:00:00.000Z");

function task(overrides: Partial<DigestTask> = {}): DigestTask {
  return {
    title: "Book the room",
    boardName: "Internal",
    columnName: "Backlog",
    dueAt: null,
    priority: "medium",
    ...overrides,
  };
}

test("tasks are grouped as overdue, this week, later, and undated", () => {
  const groups = groupDigestTasks(
    [
      task({ title: "Late thing", dueAt: "2026-09-10T12:00:00.000Z" }),
      task({ title: "Soon thing", dueAt: "2026-09-16T12:00:00.000Z" }),
      task({ title: "Far thing", dueAt: "2026-10-30T12:00:00.000Z" }),
      task({ title: "Someday thing", dueAt: null }),
    ],
    SUNDAY
  );

  assert.deepEqual(groups.overdue.map((t) => t.title), ["Late thing"]);
  assert.deepEqual(groups.thisWeek.map((t) => t.title), ["Soon thing"]);
  assert.deepEqual(groups.later.map((t) => t.title), ["Far thing"]);
  assert.deepEqual(groups.undated.map((t) => t.title), ["Someday thing"]);
});

test("a task due later the same day still counts as this week, not overdue", () => {
  const groups = groupDigestTasks([task({ dueAt: "2026-09-13T23:00:00.000Z" })], SUNDAY);
  assert.equal(groups.overdue.length, 0);
  assert.equal(groups.thisWeek.length, 1);
});

test("the subject says how many are open and calls out overdue ones", () => {
  const withOverdue = renderTaskDigestEmail({
    firstName: "Sam",
    tasks: [task({ dueAt: "2026-09-01T12:00:00.000Z" }), task()],
    siteUrl: "https://codecoogs.com",
    now: SUNDAY,
  });
  assert.ok(withOverdue);
  assert.match(withOverdue.subject, /2 open tasks/);
  assert.match(withOverdue.subject, /1 overdue/);

  const clean = renderTaskDigestEmail({
    firstName: "Sam",
    tasks: [task()],
    siteUrl: "https://codecoogs.com",
    now: SUNDAY,
  });
  assert.ok(clean);
  assert.match(clean.subject, /1 open task/);
  assert.doesNotMatch(clean.subject, /overdue/);
});

test("the greeting falls back when we have no first name", () => {
  const rendered = renderTaskDigestEmail({
    firstName: null,
    tasks: [task()],
    siteUrl: "https://codecoogs.com",
    now: SUNDAY,
  });
  assert.ok(rendered);
  assert.match(rendered.html, /Hi there,/);
});

test("task titles are escaped, since officers type them", () => {
  const rendered = renderTaskDigestEmail({
    firstName: "Sam",
    tasks: [task({ title: '<script>alert("x")</script>' })],
    siteUrl: "https://codecoogs.com",
    now: SUNDAY,
  });
  assert.ok(rendered);
  assert.doesNotMatch(rendered.html, /<script>/);
  assert.match(rendered.html, /&lt;script&gt;/);
});

test("the button points at the tasks page on the given origin", () => {
  const rendered = renderTaskDigestEmail({
    firstName: "Sam",
    tasks: [task()],
    siteUrl: "https://codecoogs.com",
    now: SUNDAY,
  });
  assert.ok(rendered);
  assert.match(rendered.html, /https:\/\/codecoogs\.com\/dashboard\/tasks/);
});

test("an empty list renders nothing to send", () => {
  const rendered = renderTaskDigestEmail({
    firstName: "Sam",
    tasks: [],
    siteUrl: "https://codecoogs.com",
    now: SUNDAY,
  });
  assert.equal(rendered, null);
});
