import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  capHistory,
  modelDownloadConsent,
  modelStartupPlan,
  safeReply,
  setModelDownloadConsent,
} from "../sites/storefront/agent.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const SAFE_REPLY = "I’ve updated the page — review the product cards and basket for current details.";

test("a downloadable model requires persisted opt-in while an installed model does not", () => {
  assert.equal(modelStartupPlan("available", false), "installed");
  assert.equal(modelStartupPlan("readily", false), "installed");
  assert.equal(modelStartupPlan("downloadable", false), "consent-required");
  assert.equal(modelStartupPlan("downloading", false), "consent-required");
  assert.equal(modelStartupPlan("after-download", false), "consent-required");
  assert.equal(modelStartupPlan("downloadable", true), "consented-download");
  assert.equal(modelStartupPlan("unavailable", true), "fallback");

  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  assert.equal(modelDownloadConsent(storage), false);
  assert.equal(setModelDownloadConsent(true, storage), true);
  assert.equal(modelDownloadConsent(storage), true);
  assert.equal(setModelDownloadConsent(false, storage), true);
  assert.equal(modelDownloadConsent(storage), false);
});

test("generated assistant prose cannot repeat amounts, quantities, or numbers", () => {
  assert.equal(safeReply("I highlighted the published delivery evidence."),
    "I highlighted the published delivery evidence.");
  for (const unsafe of [
    "That costs $12.",
    "The total is KES 1,400.",
    "I added 2 items.",
    "I added two products.",
    "Both products are ready.",
    "Several matches are visible.",
    "The quantity changed to ３.",
    "The discount is 15%.",
  ]) assert.equal(safeReply(unsafe), SAFE_REPLY, unsafe);
});

test("assistant history is capped by recent turns and total characters", () => {
  const messages = [];
  for (let turn = 0; turn < 7; turn++) {
    messages.push({ role: "user", content: `request-${turn}` });
    messages.push({ role: "system", content: "x".repeat(140) });
    messages.push({ role: "assistant", content: `done-${turn}` });
  }
  const byTurns = capHistory(messages, { maxTurns: 3, maxChars: 10_000 });
  assert.equal(byTurns.filter((message) => message.role === "user").length, 3);
  assert.equal(byTurns[0].content, "request-4");

  const byChars = capHistory(messages, { maxTurns: 10, maxChars: 300 });
  const size = byChars.reduce((sum, message) =>
    sum + message.role.length + message.content.length, 0);
  assert.ok(size <= 300, `history size ${size} exceeds the cap`);

  const oneHugeMessage = capHistory(
    [{ role: "user", content: "z".repeat(500) }],
    { maxTurns: 1, maxChars: 80 },
  );
  assert.ok(oneHugeMessage[0].role.length + oneHugeMessage[0].content.length <= 80);

  const currentTurn = capHistory([
    { role: "user", content: "keep this request" },
    ...Array.from({ length: 6 }, (_, index) => ({
      role: "system", content: `${index}:${"t".repeat(1_800)}`,
    })),
  ], { maxTurns: 4, maxChars: 8_000 });
  assert.equal(currentTurn[0].role, "user");
  assert.equal(currentTurn[0].content, "keep this request");
  assert.match(currentTurn.at(-1).content, /^5:/);
});

test("the optional model cannot delay fallback or stack form handlers", async () => {
  const [html, agent, store] = await Promise.all([
    read("../sites/storefront/index.html"),
    read("../sites/storefront/agent.js"),
    read("../sites/storefront/store.js"),
  ]);
  assert.match(html, /id="model-download-consent"[^>]*>Allow on-device model download</);
  assert.match(html, /GroundedRelay never asks for an API key/);
  assert.doesNotMatch(html, /type="password"|key-input|key-save/);
  assert.match(agent, /if \(plan === "consented-download"\) beginConsentedModelDownload\(\)/);
  assert.match(agent, /settleWithin\(localTools\(\), "Available action refresh"\)/);
  assert.match(agent, /ft:agent-fallback/);
  assert.match(store, /if \(totalProviderTools\) \{[\s\S]*?enableCatalogueSearch\([\s\S]*?hoist\(\)/);
  assert.equal((store.match(/\$\("chat-form"\)\.addEventListener\("submit"/g) ?? []).length, 1);
  assert.doesNotMatch(agent, /\$\("chat-form"\)\.addEventListener\("submit"/);
  assert.ok(store.indexOf("enableCatalogueSearch(\n    \"Local catalogue search is ready")
    < store.indexOf("const { initAgent }"));
});
