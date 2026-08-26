import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createSingleFlightReconciler,
  settleWithin,
} from "../sites/merchant-demo/tool-runtime.js";

test("rapid reconciliation calls cannot register one clean name twice", async () => {
  let releaseRegistration;
  const registrationGate = new Promise((resolve) => { releaseRegistration = resolve; });
  const registered = new Set();
  let passes = 0;
  let registerCalls = 0;
  let concurrentPasses = 0;
  let maxConcurrentPasses = 0;

  const reconcile = createSingleFlightReconciler(async () => {
    passes += 1;
    concurrentPasses += 1;
    maxConcurrentPasses = Math.max(maxConcurrentPasses, concurrentPasses);
    try {
      if (registered.has("search_products")) return;
      registerCalls += 1;
      await registrationGate;
      registered.add("search_products");
    } finally {
      concurrentPasses -= 1;
    }
  });

  const first = reconcile();
  await Promise.resolve();
  const second = reconcile();
  const third = reconcile();
  assert.equal(first, second, "calls during registration must share one flight");
  assert.equal(second, third);
  assert.equal(registerCalls, 1);

  releaseRegistration();
  await Promise.all([first, second, third]);
  assert.equal(maxConcurrentPasses, 1, "reconciliation passes must be serialized");
  assert.equal(passes, 2, "the burst is coalesced into one follow-up state pass");
  assert.equal(registerCalls, 1, "the follow-up must see the completed clean registration");
});

test("WebMCP operations are bounded and merchant timeout copy keeps direct controls", async () => {
  await assert.rejects(
    settleWithin(new Promise(() => {}), "Site Tools discovery", 5),
    (error) => error?.name === "TimeoutError"
      && /Site Tools discovery took too long/.test(error.message),
  );

  const client = await readFile(
    new URL("../sites/merchant-demo/client.js", import.meta.url), "utf8");
  assert.match(client, /TOOL_API_TIMEOUT_MS = 6_000/);
  assert.match(client, /settleWithin\(\s*modelContext\.getTools/);
  assert.match(client, /settleWithin\(modelContext\.registerTool/);
  assert.match(client, /pendingRegistrations\.set\(name, controller\)/);
  assert.match(client, /controller\.abort\(error\)/);
  assert.match(client, /pendingRegistrations\.get\(name\) === controller/);
  assert.match(client, /Site Tools discovery timed out/);
  assert.match(client, /Direct search, comparison, basket, and handoff controls remain active/);
});
