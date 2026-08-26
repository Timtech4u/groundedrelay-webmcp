import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("public WebMCP names and the human-gated handoff stay truthful", async () => {
  const provider = await read("../sites/embed/embed.js");
  const names = [...provider.matchAll(/\n\s+name: "([a-z_]+)"/g)].map((match) => match[1]);
  assert.deepEqual(names, [
    "list_shops",
    "get_shopping_state",
    "search_products",
    "inspect_products",
    "focus_products",
    "compare_products",
    "highlight_evidence",
    "set_basket_quantity",
    "prepare_checkout_handoff",
  ]);
  assert.doesNotMatch(provider, /name: "checkout"/);
  assert.doesNotMatch(provider, /destructiveHint|idempotentHint/);
  assert.match(provider, /expected_state_revision/);
  assert.match(provider, /approvalId/);
});

test("cross-origin messages are source-, origin-, and nonce-bound", async () => {
  const provider = await read("../sites/embed/embed.js");
  const host = await read("../sites/storefront/store.js");
  assert.match(provider, /e\.source !== parent/);
  assert.match(provider, /e\.data\?\.channel !== CHANNEL_NONCE/);
  assert.match(host, /e\.source !== frame\.contentWindow/);
  assert.match(host, /e\.data\?\.channel !== CHANNEL_NONCE/);
  assert.match(host, /crypto\.randomUUID\(\)/);
});

test("the customer shell has accessibility and no API-key collection surface", async () => {
  const html = await read("../sites/storefront/index.html");
  const css = await read("../sites/storefront/store.css");
  assert.match(html, /<html lang="en">/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /id="quick"[^>]+role="group"/);
  assert.doesNotMatch(html, /type="password"|key-input|key-save/);
  assert.doesNotMatch(css, /has-evidence tr:not\(\.evidence\) \{ opacity:/);
  assert.match(css, /prefers-reduced-motion/);
});

test("production provider policy pins the allowed storefront", async () => {
  const config = JSON.parse(await read("../sites/embed/vercel.json"));
  const csp = config.headers.flatMap((entry) => entry.headers)
    .find((header) => header.key === "Content-Security-Policy")?.value;
  assert.match(csp, /(?:^|;\s*)frame-ancestors /);
  assert.match(csp, /https:\/\/groundedrelay\.pages\.dev/);
  assert.doesNotMatch(csp, /localhost|127\.0\.0\.1/);
  assert.doesNotMatch(csp, /\*/);
});
