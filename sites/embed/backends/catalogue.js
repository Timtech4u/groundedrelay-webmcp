import { variantDisplayText } from "../variant-text.js";

const SEARCH_FILLER = new Set([
  "a", "an", "and", "available", "brand", "brands", "find", "for", "from",
  "in", "me", "of", "one", "pair", "please", "product", "products", "show",
  "stock", "subscription", "the", "three", "time", "to", "two", "one-time",
  "one-off", "off", "not",
]);

const provenanceTermsFor = (items) => new Set([
  "africa", "african",
  ...items.flatMap((item) => [
    String(item.merchantCountryCode ?? "").toLowerCase(),
    ...String(item.merchantCountry ?? "").toLowerCase().split(/\s+/),
  ]).filter(Boolean),
]);

const termForms = (term) => term.length > 3 && term.endsWith("s")
  ? [term, term.slice(0, -1)]
  : [term];

const wordsIn = (text) => new Set(
  String(text ?? "").toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [],
);

const containsTerm = (text, term) => {
  const words = wordsIn(text);
  return termForms(term).some((form) => words.has(form));
};

// Search stays deterministic and local. Every accepted term must be backed by
// fields in the owned fixture, while conversational filler is ignored.
export function rankProducts(items, query) {
  const rawQuery = String(query ?? "").toLowerCase();
  const availableOnly = /\bavailable\b|\bin[\s-]+stock\b/.test(rawQuery);
  const oneTimeOnly = /\bone[\s-]?time\b|\bone[\s-]?off\b|\bnot (?:a )?subscription\b/.test(rawQuery);
  const subscriptionOnly = /\bsubscription\b/.test(rawQuery)
    && !/\bnot (?:a )?subscription\b/.test(rawQuery);
  const terms = rawQuery.split(/\s+/)
    .map((term) => term.replace(/[^a-z0-9-]/g, ""))
    .filter((term) => term && !SEARCH_FILLER.has(term));
  const provenanceTerms = provenanceTermsFor(items);
  const contentTerms = terms.filter((term) => !provenanceTerms.has(term));
  const backedByStore = new Map();
  for (const item of items) {
    const storeKey = item.host ?? item.store ?? "__unknown__";
    if (!backedByStore.has(storeKey)) backedByStore.set(storeKey, new Set());
    for (const term of contentTerms) {
      if (containsTerm(item.productHaystack, term)) backedByStore.get(storeKey).add(term);
    }
  }
  return items
    .map((item) => {
      if (availableOnly && !item.available) return null;
      const isSubscription = /\bsubscription\b/i.test(item.name);
      if (oneTimeOnly && isSubscription) return null;
      if (subscriptionOnly && !isSubscription) return null;
      if (!terms.every((term) => containsTerm(item.haystack, term))) return null;
      const storeKey = item.host ?? item.store ?? "__unknown__";
      const backedTerms = backedByStore.get(storeKey) ?? new Set();
      for (const term of contentTerms) {
        const storeCategory = item.storeKeywords?.some((keyword) =>
          containsTerm(keyword, term));
        const requireProductTerm = backedTerms.has(term)
          && (!storeCategory || contentTerms.length > 1);
        if (requireProductTerm && !containsTerm(item.productHaystack, term)) return null;

        const explicitEvidence = item.categoryEvidence?.[term];
        if (explicitEvidence?.length
          && !explicitEvidence.some((fieldTerm) =>
            containsTerm(item.productHaystack, fieldTerm))) return null;
      }
      const title = item.name.toLowerCase();
      let score = terms.filter((term) => containsTerm(title, term)).length * 10;
      score += terms.filter((term) =>
        containsTerm(item.productHaystack ?? title, term)).length * 6;
      if (terms[0] && termForms(terms[0]).some((form) => title.startsWith(form))) score += 5;
      if (item.available) score += 3;
      return { item, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item);
}

export function groupBasketTotals(lines) {
  const groups = new Map();
  for (const { item, qty } of lines) {
    const currency = String(item.currency).toUpperCase();
    groups.set(currency, (groups.get(currency) ?? 0) + item.price * qty);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, subtotal]) => ({
      currency,
      subtotal,
      discount: 0,
      total: subtotal,
    }));
}

function observedRow(key, label, items, read) {
  const values = items.map(read);
  return values.some((value) => value !== null && value !== undefined && value !== "")
    ? { key, label, values }
    : null;
}

// Comparison is restricted to observed fixture fields; it never asks a model
// to infer quality, fit, delivery, or commercial claims.
export function buildComparison(items) {
  if (items.length < 2 || items.length > 3) {
    throw new Error("Compare two or three different products");
  }
  const rows = [
    observedRow("merchant", "Merchant", items, (item) => item.store),
    observedRow("merchant_country", "Merchant country", items, (item) => item.merchantCountry),
    observedRow("catalogue_market", "Catalogue market", items, (item) => item.market),
    observedRow("delivery_countries", "Published delivery countries", items,
      (item) => item.shipsTo?.length ? item.shipsTo.join(", ") : null),
    observedRow("vendor", "Published vendor", items, (item) => item.vendor),
    observedRow("product_type", "Product type", items, (item) => item.productType),
    observedRow("exact_variant", "Exact variant", items,
      (item) => variantDisplayText(item.selectedVariant)),
    observedRow("availability", "Availability", items,
      (item) => item.available ? "Available" : "Unavailable"),
    observedRow("currency", "Currency", items, (item) => item.currency),
    observedRow("current_price", "Current price", items,
      (item) => ({ amount: item.price, currency: item.currency })),
  ].filter(Boolean);

  return {
    items: items.map(({ sku, name, store, url, price, currency }) => ({
      sku,
      name,
      store,
      url,
      price,
      currency,
    })),
    rows,
    highlighted: [],
  };
}

export function applyComparisonHighlights(comparison, fields) {
  if (!comparison) throw new Error("Compare products before highlighting evidence");
  const requested = [...new Set(Array.isArray(fields) ? fields : [])];
  const valid = new Set(comparison.rows.map((row) => row.key));
  const invalid = requested.filter((field) => !valid.has(field));
  if (invalid.length) throw new Error(`Unknown comparison field(s): ${invalid.join(", ")}`);
  return { ...comparison, highlighted: requested };
}
