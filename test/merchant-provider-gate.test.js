import assert from "node:assert/strict";
import test from "node:test";

import { createMerchantProviderGate } from "../sites/merchant-demo/provider-gate.js";

const ready = { protocol: 2, dataMode: "fictional", fictional: true };
const state = {
  dataMode: "fictional",
  fictional: true,
  fixture: { rightsSafe: true, fictional: true, owner: "BasketShipper" },
};

test("independent host waits for both fictional attestations in either order", () => {
  const gate = createMerchantProviderGate();
  assert.equal(gate.receive("state", state).active, false);
  assert.equal(gate.receive("ready", ready).becameReady, true);
  assert.equal(gate.active, true);
});

test("independent host permanently rejects live, stale, or wrong-protocol evidence", () => {
  for (const [kind, message] of [
    ["ready", { ...ready, dataMode: "external", fictional: false }],
    ["ready", { ...ready, protocol: 1 }],
    ["state", { ...state, fixture: { ...state.fixture, owner: "Another party" } }],
  ]) {
    const gate = createMerchantProviderGate();
    assert.equal(gate.receive(kind, message).rejected, true);
    assert.equal(gate.receive("ready", ready).accepted, false);
    assert.equal(gate.receive("state", state).accepted, false);
    assert.equal(gate.active, false);
  }
});
