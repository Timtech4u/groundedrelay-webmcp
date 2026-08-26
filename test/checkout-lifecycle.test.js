import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createCheckoutLifecycle } from
  "../sites/embed/checkout-lifecycle.js";

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

test("direct checkout rejects id-less decisions and a matching late veto aborts handoff", async () => {
  const lifecycle = createCheckoutLifecycle({
    approvalId: "approval-a",
    revision: 4,
    requestId: "request-a",
  });

  assert.deepEqual(lifecycle.approve({
    approvalId: "approval-a", revision: 4,
  }), { matched: false, valid: false });
  assert.deepEqual(lifecycle.veto({}), { matched: false });
  assert.equal(lifecycle.signal.aborted, false);

  assert.deepEqual(lifecycle.approve({
    approvalId: "approval-a", revision: 4, requestId: "request-a",
  }), { matched: true, valid: true });
  await lifecycle.approval;
  assert.equal(lifecycle.phase, "handoff");

  assert.deepEqual(lifecycle.veto({ requestId: "request-a" }), { matched: true });
  assert.equal(lifecycle.signal.aborted, true,
    "pending identity and controller must survive approval until handoff finishes");
  assert.equal(lifecycle.signal.reason?.approvalReason, "cancelled");
  lifecycle.finish();
});

test("a delayed old veto cannot cancel the next checkout request", async () => {
  const next = createCheckoutLifecycle({
    approvalId: "approval-b",
    revision: 5,
    requestId: "request-b",
  });
  assert.deepEqual(next.veto({ requestId: "request-a" }), { matched: false });
  assert.equal(next.signal.aborted, false);
  assert.deepEqual(next.approve({
    approvalId: "approval-b", revision: 5, requestId: "request-b",
  }), { matched: true, valid: true });
  await next.approval;
  next.finish();
});

test("a matching stale approval rejects without waiting for a watchdog", async () => {
  const lifecycle = createCheckoutLifecycle({
    approvalId: "approval-c",
    revision: 8,
    requestId: "request-c",
  });
  assert.deepEqual(lifecycle.approve({
    approvalId: "approval-c", revision: 9, requestId: "request-c",
  }), { matched: true, valid: false });
  await assert.rejects(lifecycle.approval,
    (error) => error?.name === "AbortError" && error?.approvalReason === "stale");
  await nextTask();
  assert.equal(lifecycle.signal.aborted, true);
  lifecycle.finish();
});

test("provider keeps the lifecycle identity pending through backend handoff", async () => {
  const provider = await readFile(
    new URL("../sites/embed/embed.js", import.meta.url), "utf8");
  const merchant = await readFile(
    new URL("../sites/merchant-demo/client.js", import.meta.url), "utf8");
  assert.match(provider, /pendingCheckout = lifecycle/);
  assert.match(provider, /backend\.checkout\(revision, checkoutSignal\)[\s\S]+if \(pendingCheckout === lifecycle\) pendingCheckout = null/);
  assert.match(provider, /pendingCheckout\.approve\(e\.data\)/);
  assert.match(provider, /pendingCheckout\.veto\(e\.data\)/);
  assert.match(merchant, /checkoutRequestId\s*\? message\.requestId === checkoutRequestId\s*:\s*!message\.requestId/);
});
