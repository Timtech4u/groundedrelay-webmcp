import {
  applyComparisonHighlights,
  buildComparison,
  groupBasketTotals,
  rankProducts,
} from "./catalogue.js";

// BasketShipper owns this fixture and every name below is fictional. It gives the
// public submission a realistic, rights-safe catalogue without copying a
// merchant's mark, product image, description, price, or customer data.
export const RIGHTS_SAFE_MERCHANTS = Object.freeze([
  Object.freeze({
    id: "groundedrelay-demo-kigali",
    handoffSlug: "groundedrelay-demo-kigali-pantry",
    name: "BasketShipper Demo — Kigali Pantry",
    countryCode: "RW",
    countryName: "Rwanda",
    market: "RW",
    currency: "RWF",
    shipsTo: Object.freeze(["RW"]),
    keywords: Object.freeze(["eggs", "pantry", "grocery", "delivery"]),
  }),
  Object.freeze({
    id: "groundedrelay-demo-rift",
    handoffSlug: "groundedrelay-demo-rift-runworks",
    name: "BasketShipper Demo — Rift Runworks",
    countryCode: "KE",
    countryName: "Kenya",
    market: "KE",
    currency: "KES",
    shipsTo: Object.freeze(["KE", "RW", "UG", "TZ"]),
    keywords: Object.freeze(["running", "shoes", "footwear", "trail"]),
  }),
  Object.freeze({
    id: "groundedrelay-demo-accra",
    handoffSlug: "groundedrelay-demo-accra-carry-studio",
    name: "BasketShipper Demo — Accra Carry Studio",
    countryCode: "GH",
    countryName: "Ghana",
    market: "GH",
    currency: "GHS",
    shipsTo: Object.freeze(["GH", "NG", "KE", "RW"]),
    keywords: Object.freeze(["bags", "carry", "accessories", "travel"]),
  }),
]);

const RAW_PRODUCTS = Object.freeze([
  Object.freeze({
    merchant: "groundedrelay-demo-kigali", id: "family-egg-tray",
    name: "Family Egg Tray", productType: "Eggs",
    tags: Object.freeze(["eggs", "one-time", "grocery"]),
    variants: Object.freeze([
      Object.freeze({ id: "30", title: "Tray of 30", options: [], available: true, price: 7_200 }),
      Object.freeze({ id: "45", title: "Tray of 45", options: [], available: true, price: 10_400 }),
    ]),
  }),
  Object.freeze({
    merchant: "groundedrelay-demo-kigali", id: "weekend-egg-box",
    name: "Weekend Egg Box", productType: "Eggs",
    tags: Object.freeze(["eggs", "one-time", "breakfast"]),
    variants: Object.freeze([
      Object.freeze({ id: "20", title: "Box of 20", options: [], available: true, price: 5_100 }),
      Object.freeze({ id: "40", title: "Box of 40", options: [], available: true, price: 9_600 }),
    ]),
  }),
  Object.freeze({
    merchant: "groundedrelay-demo-rift", id: "nyota-road-runner",
    name: "Nyota Road Running Shoe", productType: "Running shoes",
    tags: Object.freeze(["running", "shoes", "road", "footwear"]),
    variants: Object.freeze([
      Object.freeze({ id: "38", title: "EU 38", options: ["Colour: Sand"], available: false, price: 1_480_000 }),
      Object.freeze({ id: "39", title: "EU 39", options: ["Colour: Sand"], available: true, price: 1_480_000 }),
      Object.freeze({ id: "40", title: "EU 40", options: ["Colour: Indigo"], available: true, price: 1_480_000 }),
      Object.freeze({ id: "41", title: "EU 41", options: ["Colour: Indigo"], available: true, price: 1_480_000 }),
    ]),
  }),
  Object.freeze({
    merchant: "groundedrelay-demo-rift", id: "bonde-trail-runner",
    name: "Bonde Trail Running Shoe", productType: "Running shoes",
    tags: Object.freeze(["running", "shoes", "trail", "footwear"]),
    variants: Object.freeze([
      Object.freeze({ id: "39", title: "EU 39", options: ["Colour: Clay"], available: true, price: 1_760_000 }),
      Object.freeze({ id: "40", title: "EU 40", options: ["Colour: Clay"], available: true, price: 1_760_000 }),
      Object.freeze({ id: "41", title: "EU 41", options: ["Colour: Forest"], available: true, price: 1_760_000 }),
    ]),
  }),
  Object.freeze({
    merchant: "groundedrelay-demo-accra", id: "asa-weekender",
    name: "Asa Canvas Weekender", productType: "Travel bag",
    tags: Object.freeze(["bag", "weekender", "travel", "carry"]),
    variants: Object.freeze([
      Object.freeze({ id: "ochre", title: "Ochre", options: [], available: true, price: 89_000 }),
      Object.freeze({ id: "indigo", title: "Indigo", options: [], available: true, price: 89_000 }),
    ]),
  }),
  Object.freeze({
    merchant: "groundedrelay-demo-accra", id: "cocoa-grid-carryall",
    name: "Cocoa Grid Carryall", productType: "Carryall bag",
    tags: Object.freeze(["bag", "carryall", "everyday", "carry"]),
    variants: Object.freeze([
      Object.freeze({ id: "small", title: "Small", options: ["Colour: Cocoa"], available: true, price: 54_000 }),
      Object.freeze({ id: "large", title: "Large", options: ["Colour: Cocoa"], available: false, price: 67_000 }),
    ]),
  }),
]);

const safeMerchantBase = (candidate) => {
  const url = new URL(candidate);
  const loopback = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) {
    throw new TypeError("The fictional merchant demo needs an https or loopback origin");
  }
  url.search = "";
  url.hash = "";
  return url.href;
};
const slug = (value) => String(value).toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function materialiseCatalogue(merchantBase) {
  const byId = new Map(RIGHTS_SAFE_MERCHANTS.map((merchant) => [merchant.id, merchant]));
  return RAW_PRODUCTS.map((raw) => {
    const merchant = byId.get(raw.merchant);
    const variants = raw.variants.map((variant) => ({
      sku: `demo:${merchant.id}:${raw.id}:${variant.id}`,
      title: variant.title,
      options: [...variant.options],
      available: variant.available,
      price: variant.price,
      currency: merchant.currency,
    }));
    const selected = variants.find((variant) => variant.available) ?? variants[0];
    const productHaystack = [raw.name, raw.productType, ...raw.tags].join(" ").toLowerCase();
    return {
      sku: selected.sku,
      name: raw.name,
      price: selected.price,
      currency: merchant.currency,
      stock: selected.available ? 25 : 0,
      available: selected.available,
      store: merchant.name,
      host: new URL(merchantBase).hostname,
      merchantCountry: merchant.countryName,
      merchantCountryCode: merchant.countryCode,
      market: merchant.market,
      shipsTo: [...merchant.shipsTo],
      vendor: merchant.name,
      productType: raw.productType,
      tags: [...raw.tags],
      storeKeywords: [...merchant.keywords],
      categoryEvidence: {},
      url: `${merchantBase}#product=${encodeURIComponent(raw.id)}`,
      image: null,
      productId: raw.id,
      productHandle: slug(raw.name),
      selectedVariant: { sku: selected.sku, title: selected.title, options: [...selected.options] },
      variants,
      productHaystack,
      haystack: [
        productHaystack, merchant.name, merchant.countryName, merchant.countryCode,
        ...merchant.keywords, "Africa African fictional demonstration",
        ...merchant.shipsTo, "ships shipping delivery delivered",
      ].join(" ").toLowerCase(),
    };
  });
}

export function createRightsSafeBackend({
  merchantOrigin = "https://groundedrelay-merchant.pages.dev/",
} = {}) {
  const merchantBase = safeMerchantBase(merchantOrigin);
  const catalogueItems = materialiseCatalogue(merchantBase);
  const merchantByName = new Map(
    RIGHTS_SAFE_MERCHANTS.map((merchant) => [merchant.name, merchant]),
  );
  const knownItems = new Map();
  const basketLines = new Map();
  const storageKey = "groundedrelay.rights-safe-demo.v1";
  let lastResults = [];
  let comparison = null;
  let focusedSkus = [];
  let resultSetId = 0;
  let revision = 0;
  let observedAt = null;
  let lastQuery = null;
  let preferences = { deliveryCountry: null };
  let storage = null;
  try { if (typeof window !== "undefined") storage = window.localStorage; }
  catch { /* Third-party storage can be blocked by browser policy. */ }

  const projectVariant = (item, variant) => ({
    ...item,
    sku: variant.sku,
    price: variant.price,
    currency: variant.currency,
    stock: variant.available ? 25 : 0,
    available: variant.available,
    selectedVariant: { sku: variant.sku, title: variant.title, options: [...variant.options] },
  });
  for (const item of catalogueItems) {
    knownItems.set(item.sku, item);
    for (const variant of item.variants) knownItems.set(variant.sku, projectVariant(item, variant));
  }

  try {
    const saved = JSON.parse(storage?.getItem(storageKey) || "[]");
    for (const entry of Array.isArray(saved) ? saved : []) {
      const item = knownItems.get(String(entry?.sku ?? ""));
      const qty = Number(entry?.qty);
      if (item?.available && Number.isInteger(qty) && qty > 0 && qty <= 25) {
        basketLines.set(item.sku, { item, qty });
      }
    }
  } catch { /* Storage is an optional local convenience. */ }

  const persistBasket = () => {
    try {
      storage?.setItem(storageKey, JSON.stringify(
        [...basketLines.values()].map(({ item, qty }) => ({ sku: item.sku, qty }))));
    } catch { /* Storage can be disabled in private browsing. */ }
  };
  const basket = () => {
    const cart = [...basketLines.values()].map(({ item, qty }) => ({ ...item, qty }));
    const totals = groupBasketTotals(basketLines.values());
    return { cart, totals, total: totals.length === 1 ? totals[0].total : null };
  };
  const listShops = () => ({
    shops: RIGHTS_SAFE_MERCHANTS.map((merchant) => ({
      name: merchant.name,
      host: new URL(merchantBase).hostname,
      merchantCountry: merchant.countryName,
      merchantCountryCode: merchant.countryCode,
      market: merchant.market,
      currency: merchant.currency,
      shipsTo: [...merchant.shipsTo],
      status: "reachable",
      fictional: true,
    })),
    configured: RIGHTS_SAFE_MERCHANTS.length,
    checked: RIGHTS_SAFE_MERCHANTS.length,
    pending: 0,
    ready: true,
    reachable: RIGHTS_SAFE_MERCHANTS.length,
    unavailable: [],
  });
  const catalog = async (signal) => {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    if (!lastResults.length && !lastQuery) {
      lastResults = catalogueItems.filter((item) => item.available).slice(0, 6);
      observedAt = new Date().toISOString();
      revision += 1;
    }
    return lastResults;
  };
  const search = async (input, signal) => {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    const criteria = typeof input === "object" && input !== null ? input : { query: input };
    let candidates = [...catalogueItems];
    const country = criteria.merchantCountry ?? criteria.merchant_country;
    if (country) {
      const needle = String(country).toLowerCase();
      candidates = candidates.filter((item) =>
        item.merchantCountry.toLowerCase() === needle
        || item.merchantCountryCode.toLowerCase() === needle);
    }
    const destination = criteria.shipsTo ?? criteria.ships_to ?? preferences.deliveryCountry;
    if (destination) {
      const code = String(destination).toUpperCase();
      candidates = candidates.filter((item) => item.shipsTo.includes(code));
    }
    resultSetId += 1;
    lastQuery = String(criteria.query ?? "");
    lastResults = rankProducts(candidates, lastQuery).slice(0, 12);
    comparison = null;
    focusedSkus = [];
    observedAt = new Date().toISOString();
    revision += 1;
    return {
      results: lastResults,
      resultSetId,
      observedAt,
      configured: RIGHTS_SAFE_MERCHANTS.length,
      searched: RIGHTS_SAFE_MERCHANTS.length,
      unavailable: [],
    };
  };
  const inspect = (skus) => {
    const unique = [...new Set(Array.isArray(skus) ? skus : [])];
    if (!unique.length || unique.length > 3) throw new Error("Inspect one to three products");
    if (unique.some((sku) => !lastResults.some((item) => item.sku === sku))) {
      throw new Error("Inspect accepts only products in the active result set");
    }
    const items = unique.map((sku) => knownItems.get(sku)).filter(Boolean);
    if (items.length !== unique.length) throw new Error("Search before inspecting these products");
    return items.map((item) => ({
      sku: item.sku,
      name: item.name,
      merchant: item.store,
      merchantCountry: item.merchantCountry,
      market: item.market,
      deliveryCountries: item.shipsTo,
      observedAt,
      variants: item.variants.map((variant) => ({ ...variant, options: [...variant.options] })),
    }));
  };
  const activeItemForSku = (sku) => {
    const visibleProduct = lastResults.find((item) =>
      item.sku === sku || item.variants.some((variant) => variant.sku === sku));
    return visibleProduct ? knownItems.get(sku) : null;
  };
  const focus = (skus) => {
    const unique = [...new Set(Array.isArray(skus) ? skus : [])];
    if (!unique.length || unique.length > 3) throw new Error("Focus one to three products");
    if (unique.some((sku) => !activeItemForSku(sku))) {
      throw new Error("Focus accepts only products or variants visible in the active result set");
    }
    focusedSkus = unique;
    revision += 1;
    return { focused: focusedSkus, revision };
  };
  const compare = (skus) => {
    const unique = [...new Set(Array.isArray(skus) ? skus : [])];
    if (unique.length < 2 || unique.length > 3) {
      throw new Error("Compare two or three different products");
    }
    const items = unique.map(activeItemForSku).filter(Boolean);
    if (items.length !== unique.length) {
      throw new Error("Compare accepts only products or variants visible in the active result set");
    }
    if (new Set(items.map((item) => item.productId)).size !== items.length) {
      throw new Error("Compare variants from two or three different products");
    }
    comparison = buildComparison(items);
    revision += 1;
    return comparison;
  };
  const highlight = (fields) => {
    comparison = applyComparisonHighlights(comparison, fields);
    revision += 1;
    return comparison;
  };
  const clearComparison = () => {
    comparison = null;
    revision += 1;
    return null;
  };
  const setQuantity = (sku, quantity, expectedRevision) => {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0 || qty > 25) {
      throw new Error("Quantity must be an integer from 0 to 25");
    }
    if (Number(expectedRevision) !== revision) {
      throw new Error(`Basket changed; expected revision ${expectedRevision}, current revision is ${revision}`);
    }
    if (qty === 0) {
      if (!basketLines.delete(sku)) throw new Error(`Item ${sku} is not in the basket`);
    } else {
      const inActiveResults = lastResults.some((item) =>
        item.sku === sku || item.variants.some((variant) => variant.sku === sku));
      const existingLine = basketLines.get(sku);
      if (!inActiveResults && !existingLine) {
        throw new Error("Set quantity accepts only an active result or an existing basket line");
      }
      const item = knownItems.get(sku) ?? existingLine?.item;
      if (!item) throw new Error(`Unknown item ${sku} — search first`);
      if (!item.available) throw new Error(`${item.name} is unavailable`);
      basketLines.set(sku, { item, qty });
    }
    revision += 1;
    persistBasket();
    return { ok: true, sku, quantity: qty, revision };
  };
  const add = (sku, quantity = 1) => {
    const item = knownItems.get(sku);
    const qty = Number(quantity);
    if (!item) throw new Error(`Unknown item ${sku} — search first`);
    const visibleToHuman = lastResults.some((result) =>
      result.sku === sku || result.variants.some((variant) => variant.sku === sku));
    if (!visibleToHuman) {
      throw new Error("Add accepts only a product or variant visible in the active result set");
    }
    if (!item.available) throw new Error(`${item.name} is unavailable`);
    if (!Number.isInteger(qty) || qty < 1 || qty > 25) {
      throw new Error("Quantity must be an integer from 1 to 25");
    }
    const next = (basketLines.get(sku)?.qty ?? 0) + qty;
    if (next > 25) throw new Error("Quantity cannot exceed 25");
    basketLines.set(sku, { item, qty: next });
    revision += 1;
    persistBasket();
    return `Added ${item.name} from ${item.store}.`;
  };
  const remove = (sku) => {
    if (!basketLines.delete(sku)) throw new Error(`Item ${sku} is not in the basket`);
    revision += 1;
    persistBasket();
    return "Removed from basket.";
  };
  const setPreferences = (next = {}) => {
    const country = next.deliveryCountry == null || next.deliveryCountry === ""
      ? null : String(next.deliveryCountry).toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country)) {
      throw new Error("Delivery country must be a two-letter code");
    }
    preferences = { deliveryCountry: country };
    revision += 1;
    return preferences;
  };
  const checkout = async (expectedRevision) => {
    if (!basketLines.size) throw new Error("Basket is empty");
    if (Number(expectedRevision) !== revision) {
      throw new Error(`Basket changed; expected revision ${expectedRevision}, current revision is ${revision}`);
    }
    const grouped = new Map();
    for (const { item, qty } of basketLines.values()) {
      if (!grouped.has(item.store)) grouped.set(item.store, []);
      grouped.get(item.store).push({ sku: item.sku, name: item.name, qty });
    }
    return {
      message: "Demo merchant links are ready. This fixture cannot place an order or take payment.",
      handoff: [...grouped.entries()].map(([store, items]) => {
        const handoffSlug = merchantByName.get(store)?.handoffSlug;
        if (!handoffSlug) throw new Error(`Unknown fictional merchant ${store}`);
        return {
          store,
          items: [{
            sku: `demo-handoff:${handoffSlug}`,
            name: "Open fictional merchant demo",
            qty: items.reduce((sum, item) => sum + item.qty, 0),
            url: `${merchantBase}#handoff=${encodeURIComponent(handoffSlug)}`,
          }],
        };
      }),
    };
  };
  const state = () => {
    const basketState = basket();
    const single = basketState.totals.length === 1 ? basketState.totals[0] : null;
    return {
      catalog: lastResults,
      ...basketState,
      subtotal: single?.subtotal ?? null,
      discount: single?.discount ?? null,
      reachable: RIGHTS_SAFE_MERCHANTS.map((merchant) => merchant.name),
      comparison,
      focusedSkus,
      resultSetId,
      revision,
      observedAt,
      coverage: { configured: RIGHTS_SAFE_MERCHANTS.length, searched: RIGHTS_SAFE_MERCHANTS.length, unavailable: [] },
      preferences,
      lastQuery,
      fixture: { rightsSafe: true, fictional: true, owner: "BasketShipper" },
    };
  };

  return {
    label: "BasketShipper-owned fictional demo · 3 catalogues",
    capabilities: Object.freeze({
      listShops: true, search: true, compare: true, highlight: true,
      inspect: true, focus: true, shoppingState: true, setQuantity: true,
      add: true, checkout: true,
    }),
    listShops, catalog, search, inspect, focus, compare, highlight,
    clearComparison, setQuantity, add, remove, setPreferences, checkout, state,
  };
}
