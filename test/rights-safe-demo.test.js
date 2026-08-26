import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RIGHTS_SAFE_MERCHANTS,
  createRightsSafeBackend,
} from "../sites/embed/backends/demo.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("rights-safe catalogue is GroundedRelay-owned, fictional, and complete without network data", async () => {
  const backend = createRightsSafeBackend({ merchantOrigin: "http://localhost:5175/" });
  assert.match(backend.label, /GroundedRelay-owned fictional demo/);
  assert.equal(RIGHTS_SAFE_MERCHANTS.length, 3);
  assert.ok(RIGHTS_SAFE_MERCHANTS.every((merchant) =>
    merchant.name.startsWith("GroundedRelay Demo — ")));
  assert.deepEqual(Object.entries(backend.capabilities)
    .filter(([, enabled]) => enabled).map(([name]) => name).sort(), [
    "add", "checkout", "compare", "focus", "highlight", "inspect",
    "listShops", "search", "setQuantity", "shoppingState",
  ].sort());
  assert.equal("coupon" in backend.capabilities, false);
  assert.equal("reviews" in backend.capabilities, false);

  const products = await backend.catalog();
  assert.equal(products.length, 6);
  assert.ok(products.every((product) => product.image === null));
  assert.ok(products.every((product) => new URL(product.url).origin === "http://localhost:5175"));
  assert.ok(products.every((product) => product.store.startsWith("GroundedRelay Demo — ")));
  assert.deepEqual(backend.state().fixture,
    { rightsSafe: true, fictional: true, owner: "GroundedRelay" });

  const nyota = products.find((product) => product.name === "Nyota Road Running Shoe");
  assert.ok(nyota);
  assert.match(nyota.sku, /:39$/,
    "the displayed variant must skip unavailable EU 38");
  assert.equal(nyota.selectedVariant.title, "EU 39");
});

test("production fixture handoffs stay on the exact GroundedRelay-owned merchant host", async () => {
  const backend = createRightsSafeBackend();
  const results = await backend.search({ query: "running shoes" });
  backend.setQuantity(results.results[0].sku, 1, backend.state().revision);
  const handoff = await backend.checkout(backend.state().revision);
  for (const item of handoff.handoff.flatMap((group) => group.items)) {
    assert.equal(new URL(item.url).origin, "https://groundedrelay-merchant.pages.dev");
  }
});

test("fictional journey exercises evidence, exact variants, revisions, and separated currencies", async () => {
  const backend = createRightsSafeBackend({ merchantOrigin: "http://localhost:5175/" });
  const shoes = await backend.search({ query: "running shoes", shipsTo: "RW" });
  assert.deepEqual(shoes.results.map((product) => product.name), [
    "Nyota Road Running Shoe",
    "Bonde Trail Running Shoe",
  ]);
  const inspected = backend.inspect(shoes.results.map((product) => product.sku));
  assert.equal(inspected[0].variants.length, 4);
  assert.equal(inspected[0].variants[0].available, false);

  const comparison = backend.compare(shoes.results.map((product) => product.sku));
  assert.ok(comparison.rows.some((row) => row.key === "exact_variant"));
  backend.highlight(["exact_variant", "availability", "current_price"]);
  assert.deepEqual(backend.state().comparison.highlighted,
    ["exact_variant", "availability", "current_price"]);

  const shoeSku = inspected[0].variants.find((variant) => variant.title === "EU 40").sku;
  const shoeChange = backend.setQuantity(shoeSku, 1, backend.state().revision);
  assert.throws(() => backend.setQuantity(shoeSku, 2, shoeChange.revision - 1),
    /Basket changed/);

  const bags = await backend.search({ query: "travel bag", shipsTo: "RW" });
  const weekender = bags.results.find((product) => product.name === "Asa Canvas Weekender");
  assert.ok(weekender);
  backend.setQuantity(weekender.sku, 1, backend.state().revision);
  assert.deepEqual(backend.state().totals.map((total) => total.currency), ["GHS", "KES"]);
  assert.equal(backend.state().total, null, "unlike currencies must never collapse");

  const handoff = await backend.checkout(backend.state().revision);
  assert.match(handoff.message, /cannot place an order or take payment/);
  assert.equal(handoff.handoff.length, 2);
  for (const item of handoff.handoff.flatMap((group) => group.items)) {
    const url = new URL(item.url);
    assert.equal(url.origin, "http://localhost:5175");
    assert.ok(url.hash.startsWith("#handoff="));
  }
});

test("fixture derives write scope from active results while inspection stays read-only", async () => {
  const backend = createRightsSafeBackend({ merchantOrigin: "http://localhost:5175/" });
  const shoes = await backend.search({ query: "running shoes", shipsTo: "RW" });
  const guessedBag = "demo:groundedrelay-demo-accra:asa-weekender:ochre";
  const guessedShoeVariant = "demo:groundedrelay-demo-rift:nyota-road-runner:40";
  assert.throws(() => backend.inspect([guessedBag]), /active result set/);
  assert.throws(() => backend.compare([shoes.results[0].sku, guessedBag]), /active result set/);
  assert.throws(() => backend.setQuantity(
    guessedBag, 1, backend.state().revision), /active result|existing basket line/);
  const beforeInspect = backend.state();
  backend.inspect([shoes.results[0].sku]);
  assert.deepEqual(backend.state(), beforeInspect, "read-only inspection cannot mutate hidden state");
  assert.equal(backend.setQuantity(
    guessedShoeVariant, 1, backend.state().revision).quantity, 1);
  await backend.search({ query: "query-with-no-fixture-match" });
  assert.equal(backend.state().catalog.length, 0);
  assert.equal(backend.setQuantity(
    guessedShoeVariant, 2, backend.state().revision).quantity, 2,
    "a persisted basket line remains mutable in the advertised five-action branch");
  backend.setQuantity(guessedShoeVariant, 0, backend.state().revision);
  assert.throws(() => backend.setQuantity(
    guessedShoeVariant, 1, backend.state().revision), /active result|existing basket line/);
});

test("direct human controls can add a visible exact variant without weakening agent writes", async () => {
  const backend = createRightsSafeBackend({ merchantOrigin: "http://localhost:5175/" });
  const shoes = await backend.search({ query: "running shoes", shipsTo: "RW" });
  const visibleVariant = shoes.results[0].variants.find((variant) => variant.title === "EU 40");
  await backend.add(visibleVariant.sku, 1);
  assert.equal(backend.state().cart[0].selectedVariant.title, "EU 40");
  await backend.search({ query: "travel bag" });
  assert.throws(() => backend.add(visibleVariant.sku, 1), /visible in the active result set/);
});

test("comparison and focus accept exact variants visible on active product cards", async () => {
  const backend = createRightsSafeBackend({ merchantOrigin: "http://localhost:5175/" });
  const { results } = await backend.search({ query: "running shoes", shipsTo: "RW" });
  const nyota40 = results[0].variants.find((variant) => variant.title === "EU 40").sku;
  const bonde41 = results[1].variants.find((variant) => variant.title === "EU 41").sku;
  assert.deepEqual(backend.focus([nyota40]).focused, [nyota40]);
  const comparison = backend.compare([nyota40, bonde41]);
  assert.deepEqual(comparison.items.map((item) => item.sku), [nyota40, bonde41]);
  assert.deepEqual(
    comparison.rows.find((row) => row.key === "exact_variant").values,
    ["EU 40 · Colour: Indigo", "EU 41 · Colour: Forest"],
  );
  assert.throws(() => backend.compare([nyota40, results[0].sku]),
    /different products/);
});

test("provider is fixture-only and query parameters cannot select external data", async () => {
  const provider = await read("../sites/embed/embed.js");
  assert.match(provider, /createRightsSafeBackend\(\{ merchantOrigin: merchantDemoBase \}\)/);
  assert.match(provider, /const localIntegration = isLocalHost\(HOST_ORIGIN\)/);
  assert.doesNotMatch(provider, /createShopifyBackend|createWebBackend|research-stores/);
  assert.match(provider, /data_mode: "fictional_judge_demo"/);
  assert.match(provider, /dataMode: current\.fixture\?\.rightsSafe \? "fictional"/);
  assert.match(provider, /merchantDemoBase[\s\S]+https:\/\/groundedrelay-merchant\.pages\.dev\//);
  assert.match(provider, /"https:\/\/groundedrelay-merchant\.pages\.dev"/);
});

test("independent host preserves the cross-origin and state-aware WebMCP contract", async () => {
  const html = await read("../sites/merchant-demo/index.html");
  const client = await read("../sites/merchant-demo/client.js");
  const server = await read("../server.js");
  assert.match(html, /GroundedRelay-owned judge sandbox/);
  assert.match(html, /allow="tools"/);
  assert.match(html, /id="handoff"[\s\S]+aria-describedby="handoff-note"/);
  assert.match(html, /id="handoff-note"[\s\S]+No order or payment was created,[\s\S]+nothing opened automatically/);
  assert.match(client, /event\.origin !== providerOrigin/);
  assert.match(client, /event\.source !== frame\.contentWindow/);
  assert.match(client, /event\.data\?\.channel !== channel/);
  assert.match(client, /createMerchantProviderGate\(\)/);
  assert.match(client, /providerGate\.receive\(kind, message\)/);
  assert.match(client, /JSON\.stringify\(value \?\? \{\}\)/);
  for (const name of [
    "list_shops", "get_shopping_state", "search_products", "inspect_products",
    "focus_products", "compare_products", "highlight_evidence",
    "set_basket_quantity", "prepare_checkout_handoff",
  ]) assert.match(client, new RegExp(`"${name}"`));
  assert.doesNotMatch(client, /\$\{esc\(total\.currency\)\} \$\{esc\(money/,
    "formatted currency totals must not repeat the ISO code");
  assert.match(client, /approvalVariantText\(item\.selectedVariant\)/,
    "approval details must use the tested variant formatter");
  assert.match(client, /Highlight decision evidence/);
  assert.match(client,
    /fields: \["merchant", "exact_variant", "availability", "currency", "current_price"\]/);
  assert.match(server, /sites\/merchant-demo/);
  assert.match(server, /5175/);
});

test("independent host bounds provider and approval waits and restores the safe exit", async () => {
  const html = await read("../sites/merchant-demo/index.html");
  const client = await read("../sites/merchant-demo/client.js");
  assert.match(html, /id="approval-status"[^>]+role="status"[^>]+aria-live="assertive"/);
  assert.match(client, /const PROVIDER_TIMEOUT_MS = 10_000/);
  assert.match(client, /const CHECKOUT_TIMEOUT_MS = 10_000/);
  assert.match(client, /const APPROVAL_TIMEOUT_MS = 8_000/);
  assert.match(client, /frame\.addEventListener\("error", \(\) => providerUnavailable/);
  assert.match(client, /if \(!providerAnswered\) providerUnavailable/);
  assert.match(client, /function resetApprovalControls[\s\S]+\$\("veto"\)\.disabled = false/);
  assert.match(client, /message\.type === "embed:awaiting-approval"[\s\S]+resetApprovalControls\(\)[\s\S]+openModal\("approval", "veto"\)/);
  assert.match(client, /approvalTimer = setTimeout\([\s\S]+\$\("veto"\)\.disabled = false[\s\S]+Cancel anyway/);
  assert.match(client, /message\.type === "embed:ui-error"[\s\S]+recoverProviderUi/);
  assert.match(client, /checkoutRequestTimer = setTimeout\([\s\S]+provider did not open the review/);
});
