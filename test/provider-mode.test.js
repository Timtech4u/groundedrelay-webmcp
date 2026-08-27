import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyStorefrontExperience,
  createFictionalProviderGate,
  resolveStorefrontMode,
} from "../sites/storefront/provider-mode.js";

const fixtureState = {
  protocol: 2,
  dataMode: "fictional",
  fictional: true,
  fixture: { rightsSafe: true, fictional: true, owner: "BasketShipper" },
};

test("local and public entry URLs always request the owned fixture", () => {
  assert.deepEqual(resolveStorefrontMode("http://localhost:5173/"), {
    loopback: true,
    requireFictional: true,
  });
  assert.deepEqual(resolveStorefrontMode("http://localhost:5173/?scope=fixture"), {
    loopback: true,
    requireFictional: true,
  });
});

test("only trusted fictional state can select the visible experience", () => {
  const externalState = { dataMode: "external", fictional: false };

  assert.equal(classifyStorefrontExperience(externalState), null);
  assert.equal(classifyStorefrontExperience(fixtureState), "fixture");
});

test("loopback fixture rehearsal rejects live and wrong-owner state", () => {
  const mode = resolveStorefrontMode("http://localhost:5173/?scope=fixture");
  assert.equal(mode.requireFictional, true);
  for (const badState of [
    { dataMode: "external", fictional: false },
    { ...fixtureState, fixture: { rightsSafe: true, fictional: true, owner: "Other" } },
  ]) {
    const gate = createFictionalProviderGate(mode.requireFictional);
    assert.equal(gate.receive("ready", fixtureState).accepted, true);
    assert.equal(gate.receive("state", badState).rejected, true);
    assert.equal(gate.active, false);
  }
});

test("query overrides cannot select another backend on any host", () => {
  for (const href of [
    "https://groundedrelay.pages.dev/",
    "https://groundedrelay.pages.dev/?scope=external&backend=remote",
    "http://localhost:5173/?scope=external&backend=remote&shop=attacker.example",
  ]) {
    assert.deepEqual(resolveStorefrontMode(href), {
      loopback: href.startsWith("http://localhost"),
      requireFictional: true,
    });
  }
});

test("public gate refuses external ready or state and cannot recover", () => {
  for (const [kind, message] of [
    ["ready", { dataMode: "external", fictional: false }],
    ["state", { dataMode: "external", fictional: false }],
  ]) {
    const gate = createFictionalProviderGate(true);
    const refused = gate.receive(kind, message);
    assert.equal(refused.rejected, true);
    assert.equal(gate.active, false);
    assert.equal(gate.receive("ready", fixtureState).accepted, false);
    assert.equal(gate.receive("state", fixtureState).accepted, false);
  }
});

test("public gate activates only after ready and owned state both attest fiction", () => {
  const stateFirst = createFictionalProviderGate(true);
  assert.deepEqual(stateFirst.receive("state", fixtureState), {
    accepted: true, rejected: false, active: false, becameReady: false, wasActive: false,
  });
  assert.equal(stateFirst.receive("ready", fixtureState).becameReady, true);
  assert.equal(stateFirst.active, true);

  const missingOwner = createFictionalProviderGate(true);
  assert.equal(missingOwner.receive("ready", fixtureState).accepted, true);
  assert.equal(missingOwner.receive("state", {
    dataMode: "fictional", fictional: true,
    fixture: { rightsSafe: true, fictional: true },
  }).rejected, true);
});

test("public gate rejects a fictional-looking handshake on the wrong protocol", () => {
  const gate = createFictionalProviderGate(true);
  assert.equal(gate.receive("ready", {
    dataMode: "fictional", fictional: true, protocol: 1,
  }).rejected, true);
  assert.equal(gate.active, false);
});
