import assert from "node:assert/strict";
import test from "node:test";

import {
  compactInspection,
  compactSearch,
  compactShopList,
  compactShoppingState,
} from "../sites/embed/tool-output.js";

const underBudget = (value) => JSON.stringify(value).length < 1_500;

test("representative agent-facing outputs stay within the context budget", () => {
  const shops = Array.from({ length: 8 }, (_, index) => ({
    name: `Merchant ${index}`,
    merchantCountry: `Country ${index}`,
    market: "US",
    currency: "USD",
    status: "reachable",
    shipsTo: ["RW", "KE", "US"],
  }));
  assert.equal(underBudget(compactShopList({
    configured: 8, checked: 8, pending: 0, ready: true,
    reachable: 8, unavailable: [], shops,
  })), true);

  assert.deepEqual(compactShopList({
    configured: 1, checked: 0, pending: 1, ready: false,
    reachable: 0, unavailable: [],
    shops: [{ ...shops[0], status: "not_checked" }],
  }), {
    ok: true,
    configured: 1,
    checked: 0,
    pending: 1,
    ready: false,
    reachable: 0,
    unavailable: [],
    shops: [{
      name: "Merchant 0",
      country: "Country 0",
      market: "US",
      currency: "USD",
      status: "not_checked",
      publishedDeliveryCountryCount: 3,
    }],
  });

  const products = Array.from({ length: 12 }, (_, index) => ({
    sku: `shop.example|${index}`,
    name: `Grounded product ${index}`,
    available: true,
    price: 1_000 + index,
    currency: "USD",
    store: `Merchant ${index}`,
    merchantCountry: "Kenya",
    market: "US",
    productType: "Running shoes",
    shipsTo: ["RW", "KE"],
  }));
  assert.equal(underBudget(compactSearch({
    resultSetId: 4,
    observedAt: "2026-08-26T12:00:00.000Z",
    searched: 8,
    unavailable: [],
  }, products, "RW")), true);

  assert.equal(underBudget(compactShoppingState({
    revision: 6,
    resultSetId: 4,
    observedAt: "2026-08-26T12:00:00.000Z",
    catalog: products,
    focusedSkus: products.slice(0, 2).map((item) => item.sku),
    comparison: { items: products.slice(0, 2) },
    cart: products.slice(0, 2).map((item) => ({ ...item, qty: 1 })),
    totals: [{ currency: "USD", total: 2_001 }],
  })), true);
});

test("variant inspection is bounded even when a feed publishes many variants", () => {
  const variants = Array.from({ length: 100 }, (_, index) => ({
    sku: `shop.example|variant-${index}`,
    title: `Size ${index}`,
    options: [`Size ${index}`],
    available: index % 2 === 0,
    price: 1_000 + index,
    currency: "USD",
  }));
  const compact = compactInspection([{
    sku: "shop.example|1",
    name: "A product with a deliberately ordinary title",
    merchant: "Merchant",
    merchantCountry: "Kenya",
    market: "US",
    observedAt: "2026-08-26T12:00:00.000Z",
    deliveryCountries: ["RW"],
    variants,
  }]);
  assert.equal(compact[0].variantCount, 100);
  assert.ok(compact[0].variants.length < variants.length);
  assert.equal(underBudget(compact), true);
});
