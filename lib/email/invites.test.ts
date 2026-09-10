import assert from "node:assert/strict";
import test from "node:test";

import { renderAttendanceInvite, renderReinvite } from "./invites.ts";

const SITE = "https://app.codecoogs.com";

test("the reinvite links to the reset flow with the address prefilled", () => {
  const { html } = renderReinvite({
    firstName: "Ada",
    email: "ada@cougarnet.uh.edu",
    siteUrl: SITE,
  });
  assert.ok(
    html.includes(
      `${SITE}/forgot-password?email=${encodeURIComponent("ada@cougarnet.uh.edu")}`
    )
  );
  assert.ok(html.includes("Hi Ada,"));
});

test("the attendance invite goes to signup, since there is no account to reset", () => {
  const { html } = renderAttendanceInvite({
    firstName: "Ada",
    email: "ada@example.com",
    siteUrl: SITE,
  });
  assert.ok(html.includes(`${SITE}/signup`));
  assert.ok(!html.includes("/forgot-password"));
});

test("a plus-addressed email survives the round trip into the link", () => {
  const email = "ada+club@example.com";
  const { html } = renderReinvite({ firstName: null, email, siteUrl: SITE });
  // A raw "+" in a query value decodes to a space on the other side.
  assert.ok(html.includes("ada%2Bclub%40example.com"));
});

test("a hostile first name cannot inject markup", () => {
  const { html } = renderReinvite({
    firstName: '<script>alert("x")</script>',
    email: "ada@example.com",
    siteUrl: SITE,
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("a missing name degrades to a plain greeting, not 'Hi ,'", () => {
  for (const firstName of [null, "", "   "]) {
    const { html } = renderReinvite({
      firstName,
      email: "ada@example.com",
      siteUrl: SITE,
    });
    assert.ok(html.includes("Hi there,"));
    assert.ok(!html.includes("Hi ,"));
  }
});

test("both emails name the recipient address in the footer", () => {
  const email = "ada@example.com";
  for (const render of [renderReinvite, renderAttendanceInvite]) {
    const { html, subject } = render({ firstName: "Ada", email, siteUrl: SITE });
    assert.ok(html.includes(`Sent to ${email}`));
    assert.ok(subject.length > 0);
  }
});

test("the mascot is an absolute URL on the site, since email cannot resolve a relative path", () => {
  for (const render of [renderReinvite, renderAttendanceInvite]) {
    const { html } = render({
      firstName: "Ada",
      email: "ada@example.com",
      siteUrl: SITE,
    });
    assert.ok(html.includes(`${SITE}/images/icons/coco-nice.png`));
    assert.ok(!html.includes('src="/images'));
    // Decorative: the wordmark carries the branding when images are blocked.
    assert.ok(html.includes('alt=""'));
  }
});
