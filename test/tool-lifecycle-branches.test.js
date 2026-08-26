import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const activeCount = ({ results = false, comparison = false, basket = false }) =>
  3
  + (results ? 3 : 0)
  + (results || basket ? 1 : 0)
  + (comparison ? 1 : 0)
  + (basket ? 1 : 0);

test("state-aware surface follows branches rather than an artificial linear count", async () => {
  assert.equal(activeCount({}), 3);
  assert.equal(activeCount({ results: true }), 7);
  assert.equal(activeCount({ results: true, comparison: true }), 8);
  assert.equal(activeCount({ results: true, basket: true }), 8,
    "adding before comparison exposes handoff but not highlight");
  assert.equal(activeCount({ basket: true }), 5,
    "a persisted basket with zero results exposes state, search, quantity, and handoff");
  assert.equal(activeCount({ results: true, comparison: true, basket: true }), 9);

  for (const path of [
    "../sites/storefront/store.js",
    "../sites/merchant-demo/client.js",
  ]) {
    const source = await read(path);
    const start = source.indexOf("function desiredToolNames()");
    const end = source.indexOf("\n}\n", start) + 2;
    const block = source.slice(start, end);
    assert.match(block, /if \(hasResults\)[\s\S]+inspect_products[\s\S]+focus_products[\s\S]+compare_products/);
    assert.match(block, /if \(hasResults \|\| hasBasket\) desired\.add\("set_basket_quantity"\)/);
    assert.match(block, /comparison\?\.items\?\.length\) desired\.add\("highlight_evidence"\)/);
    assert.match(block, /if \(hasBasket\) desired\.add\("prepare_checkout_handoff"\)/);
  }
});
