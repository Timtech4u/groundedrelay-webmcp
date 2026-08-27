import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createRightsSafeBackend } from "../sites/embed/backends/demo.js";
import {
  handoffStoreFromHash,
  uniqueApprovedMerchantLinks,
} from "../sites/merchant-demo/handoff.js";

test("approved fixture handoff exposes exactly one owned link per merchant", async () => {
  const backend = createRightsSafeBackend({ merchantOrigin: "http://localhost:5175/" });
  const { results } = await backend.search({ query: "running shoes" });
  backend.setQuantity(results[0].sku, 1, backend.state().revision);
  backend.setQuantity(results[1].sku, 1, backend.state().revision);
  const { handoff } = await backend.checkout(backend.state().revision);
  assert.equal(handoff.length, 1);
  assert.equal(handoff[0].items.length, 1,
    "two basket lines at one fictional merchant must not duplicate its link");

  const duplicated = [{
    ...handoff[0],
    items: [...handoff[0].items, ...handoff[0].items],
  }];
  assert.deepEqual(
    uniqueApprovedMerchantLinks(duplicated, "http://localhost:5175"),
    [{
      store: "BasketShipper Demo — Rift Runworks",
      url: "http://localhost:5175/#handoff=groundedrelay-demo-rift-runworks",
    }],
    "the host defensively deduplicates an older provider response too",
  );
});

test("fictional handoff hashes acknowledge known stores and ignore everything else", async () => {
  assert.equal(handoffStoreFromHash("#handoff=groundedrelay-demo-kigali-pantry"),
    "BasketShipper Demo — Kigali Pantry");
  assert.equal(handoffStoreFromHash("#handoff=unknown"), null);
  assert.equal(handoffStoreFromHash("#handoff=groundedrelay-demo-kigali-pantry&extra=1"), null);
  assert.equal(handoffStoreFromHash("#product=family-egg-tray"), null);
  assert.equal(handoffStoreFromHash("#handoff=%3Cscript%3E"), null);

  const html = await readFile(
    new URL("../sites/merchant-demo/index.html", import.meta.url), "utf8");
  const client = await readFile(
    new URL("../sites/merchant-demo/client.js", import.meta.url), "utf8");
  assert.match(html, /id="handoff-ack"[^>]+hidden[^>]+role="status"/);
  assert.match(client, /handoffStoreFromHash\(location\.hash\)/);
  assert.match(client, /Demo only — no order was created, no merchant was contacted, and no payment is possible/);
  assert.doesNotMatch(client, /location\.(?:assign|replace)\(|window\.open\(/);
});

test("unowned or mismatched handoff links are discarded", () => {
  const handoff = [{
    store: "BasketShipper Demo — Kigali Pantry",
    items: [
      { url: "https://attacker.example/#handoff=groundedrelay-demo-kigali-pantry" },
      { url: "http://localhost:5175/#handoff=groundedrelay-demo-rift-runworks" },
    ],
  }];
  assert.deepEqual(uniqueApprovedMerchantLinks(handoff, "http://localhost:5175"), []);
});
