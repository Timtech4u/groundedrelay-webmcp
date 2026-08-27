import assert from "node:assert/strict";
import test from "node:test";

import {
  applyComparisonHighlights,
  buildComparison,
  groupBasketTotals,
  rankProducts,
} from "../sites/embed/backends/catalogue.js";

test("judge-style search treats quantity and availability as intent", () => {
  const runningShoe = {
    name: "Nyota Road Running Shoe",
    productHaystack: "nyota road running shoe",
    haystack: "nyota road running shoe kenya africa african",
    merchantCountry: "Kenya",
    merchantCountryCode: "KE",
    available: true,
  };
  const unavailableShoe = {
    ...runningShoe,
    name: "Archive Running Shoe",
    productHaystack: "archive running shoe",
    haystack: "archive running shoe kenya africa african",
    available: false,
  };
  const africanArt = {
    name: "African Art Print",
    productHaystack: "african art print",
    haystack: "african art print ghana africa african",
    merchantCountry: "Ghana",
    merchantCountryCode: "GH",
    available: true,
  };
  assert.deepEqual(
    rankProducts([unavailableShoe, africanArt, runningShoe],
      "find two available African running shoes"),
    [runningShoe],
  );
});

test("one-time intent excludes subscription products", () => {
  const once = {
    name: "Family Egg Tray",
    productHaystack: "family egg tray one-time",
    haystack: "family egg tray one-time rwanda africa african",
    merchantCountry: "Rwanda",
    merchantCountryCode: "RW",
    available: true,
  };
  const subscription = {
    ...once,
    name: "Family Egg Subscription",
    productHaystack: "family egg subscription",
    haystack: "family egg subscription rwanda africa african",
  };
  assert.deepEqual(rankProducts([subscription, once], "one-time eggs"), [once]);
});

test("search uses word boundaries and grounded category evidence", () => {
  const bag = {
    name: "Asa Canvas Bag",
    productHaystack: "asa canvas bag travel",
    haystack: "asa canvas bag travel ghana africa african",
    merchantCountry: "Ghana",
    merchantCountryCode: "GH",
    available: true,
  };
  const baggyChinos = {
    name: "Baggy Chinos",
    productHaystack: "baggy chinos clothing",
    haystack: "baggy chinos clothing ghana africa african",
    merchantCountry: "Ghana",
    merchantCountryCode: "GH",
    available: true,
  };
  assert.deepEqual(rankProducts([baggyChinos, bag], "bags"), [bag]);

  const shoe = {
    sku: "shoe",
    name: "Nyota",
    productHaystack: "nyota shoes road-running",
    haystack: "nyota shoes road-running kenya running footwear africa african",
    merchantCountry: "Kenya",
    merchantCountryCode: "KE",
    storeKeywords: ["running", "shoes", "footwear"],
    categoryEvidence: { running: ["shoes"] },
    available: true,
  };
  const hoodie = {
    ...shoe,
    sku: "hoodie",
    name: "Runworks Hoodie",
    productHaystack: "runworks hoodie clothing",
    haystack: "runworks hoodie clothing kenya running shoes footwear africa african",
  };
  assert.deepEqual(rankProducts([hoodie, shoe], "African running shoes"), [shoe]);
});

test("basket totals remain separate when currencies differ", () => {
  assert.deepEqual(groupBasketTotals([
    { item: { currency: "RWF", price: 4_500 }, qty: 2 },
    { item: { currency: "GHS", price: 1_200 }, qty: 1 },
    { item: { currency: "RWF", price: 1_000 }, qty: 3 },
  ]), [
    { currency: "GHS", subtotal: 1_200, discount: 0, total: 1_200 },
    { currency: "RWF", subtotal: 12_000, discount: 0, total: 12_000 },
  ]);
});

test("comparison contains only constrained observed fields", () => {
  const items = [
    {
      sku: "eggs|1", name: "Family Egg Tray", store: "BasketShipper Demo — Kigali Pantry",
      url: "https://merchant.example/#eggs", merchantCountry: "Rwanda", market: "RW",
      shipsTo: ["RW"], vendor: "BasketShipper Demo — Kigali Pantry", productType: "Eggs",
      selectedVariant: { title: "Tray of 30" }, available: true,
      currency: "RWF", price: 7_200,
    },
    {
      sku: "shoe|2", name: "Nyota Road Running Shoe",
      store: "BasketShipper Demo — Rift Runworks", url: "https://merchant.example/#shoe",
      merchantCountry: "Kenya", market: "KE", shipsTo: ["KE", "RW"],
      vendor: "BasketShipper Demo — Rift Runworks", productType: "Running shoes",
      selectedVariant: { title: "EU 40", options: ["Colour: Indigo"] }, available: true,
      currency: "KES", price: 1_480_000,
    },
  ];
  const comparison = buildComparison(items);
  assert.deepEqual(comparison.rows.map((row) => row.key), [
    "merchant", "merchant_country", "catalogue_market", "delivery_countries",
    "vendor", "product_type", "exact_variant", "availability", "currency",
    "current_price",
  ]);
  assert.deepEqual(comparison.rows.find((row) => row.key === "exact_variant").values,
    ["Tray of 30", "EU 40 · Colour: Indigo"]);
});

test("comparison highlighting accepts only returned row keys", () => {
  const comparison = {
    items: [{ sku: "a" }, { sku: "b" }],
    rows: [
      { key: "merchant", label: "Merchant", values: ["A", "B"] },
      { key: "current_price", label: "Current price", values: [1, 2] },
    ],
    highlighted: [],
  };
  const highlighted = applyComparisonHighlights(
    comparison, ["current_price", "merchant", "current_price"]);
  assert.deepEqual(highlighted.highlighted, ["current_price", "merchant"]);
  assert.deepEqual(comparison.highlighted, []);
  assert.throws(() => applyComparisonHighlights(comparison, ["made_up_spec"]),
    /Unknown comparison field/);
});
