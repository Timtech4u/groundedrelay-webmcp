import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createCheckoutLifecycle } from "../sites/storefront/checkout-lifecycle.js";
import { createSerialQueue } from "../sites/storefront/serial-queue.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("a timed-out checkout stays suppressed across a successful retry", () => {
  const ids = ["attempt-a", "attempt-b"];
  const lifecycle = createCheckoutLifecycle(() => ids.shift());

  const timedOut = lifecycle.start();
  assert.equal(timedOut, "attempt-a");
  assert.equal(lifecycle.cancel(), "attempt-a");
  assert.equal(lifecycle.accepts("attempt-a"), false);

  const retry = lifecycle.start();
  assert.equal(retry, "attempt-b");
  assert.equal(lifecycle.accepts("attempt-a"), false,
    "a late first approval cannot be mistaken for the retry");
  assert.equal(lifecycle.accepts("attempt-b"), true);
  assert.equal(lifecycle.finish("attempt-b"), true);
  assert.equal(lifecycle.activeRequestId, null);
});

test("tool reconciliation queue never overlaps delayed registrations", async () => {
  const queue = createSerialQueue();
  const release = [];
  const order = [];
  let active = 0;
  let maximum = 0;
  const task = (name) => queue.run(async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    order.push(`start:${name}`);
    await new Promise((resolve) => release.push(resolve));
    order.push(`end:${name}`);
    active -= 1;
  });

  const first = task("first");
  const second = task("second");
  await Promise.resolve();
  assert.deepEqual(order, ["start:first"]);
  release.shift()();
  await first;
  await Promise.resolve();
  assert.deepEqual(order, ["start:first", "end:first", "start:second"]);
  release.shift()();
  await second;
  assert.equal(maximum, 1);
});

test("primary host vetoes watchdog timeouts and restores an enabled launch control", async () => {
  const source = await read("../sites/storefront/store.js");
  const checkoutStart = source.indexOf('$("basket-checkout").addEventListener');
  const checkoutEnd = source.indexOf('\n});', checkoutStart) + 4;
  const checkoutBlock = source.slice(checkoutStart, checkoutEnd);
  assert.match(checkoutBlock, /checkoutLifecycle\.start\(\)/);
  assert.match(checkoutBlock, /checkoutLifecycle\.cancel\(\)[\s\S]+type: "host:veto"[\s\S]+setCheckoutBusy\(false/);
  assert.match(checkoutBlock, /type: "host:checkout", requestId/);

  const vetoStart = source.indexOf("function veto(");
  const vetoEnd = source.indexOf("\n}", vetoStart) + 2;
  const vetoBlock = source.slice(vetoStart, vetoEnd);
  assert.ok(vetoBlock.indexOf("setCheckoutBusy(false") < vetoBlock.indexOf("closeApproval()"),
    "the launch button must be re-enabled before focus restoration");
  assert.match(source, /approvalReturnFocus = checkoutReturnFocus\?\.isConnected/);
  assert.match(source, /if \(approvalReturnFocus\?\.isConnected\) approvalReturnFocus\.focus\(\)/);
});

test("primary host waits for explicit approved and revision-valid resolution", async () => {
  const source = await read("../sites/storefront/store.js");
  assert.match(source, /d\.outcome === "approved" && d\.valid === true/);
  assert.match(source, /d\.reason === "stale"[\s\S]+Your basket changed before approval finished/);
  assert.match(source, /ignored \$\{d\.type\} from a cancelled or superseded checkout request/);
});

test("startup health check tracks the fictional-safe storefront shell", async () => {
  const script = await read("../scripts/start-local.sh");
  assert.match(script, /<title>BasketShipper — fictional shopping demo<\/title>/);
  assert.doesNotMatch(script, /shop across African brands/);
});
