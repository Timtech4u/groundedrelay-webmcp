export const compactProduct = (product, requestedDestination = "") => ({
  sku: product.sku,
  name: product.name,
  available: Boolean(product.available ?? product.stock),
  price: product.price,
  currency: product.currency,
  merchant: product.store,
  merchantCountry: product.merchantCountry,
  catalogueMarket: product.market,
  productType: product.productType,
  publishedDelivery: product.shipsTo?.includes(String(requestedDestination).toUpperCase())
    ? "yes" : product.shipsTo?.length ? "published_list_available" : "unknown",
});

export function compactShopList(out) {
  return {
    ok: true,
    configured: out.configured,
    checked: out.checked,
    pending: out.pending,
    ready: out.ready,
    reachable: out.reachable,
    unavailable: out.unavailable,
    shops: out.shops.map((shop) => ({
      name: shop.name,
      country: shop.merchantCountry,
      market: shop.market,
      currency: shop.currency,
      status: shop.status,
      publishedDeliveryCountryCount: shop.shipsTo?.length ?? 0,
    })),
  };
}

export function compactSearch(out, hits, requestedDestination = "") {
  return {
    result_set_id: out.resultSetId ?? 0,
    observed_at: out.observedAt ?? null,
    matched: hits.length,
    shown_on_page: hits.length,
    searched: out.searched ?? null,
    unavailable: out.unavailable ?? [],
    products: hits.slice(0, 5).map((product) =>
      compactProduct(product, requestedDestination)),
  };
}

export function compactShoppingState(current) {
  return {
    revision: Number(current.revision ?? 0),
    result_set_id: Number(current.resultSetId ?? 0),
    observed_at: current.observedAt ?? null,
    result_skus: (current.catalog ?? []).map((item) => item.sku).slice(0, 12),
    focused_skus: current.focusedSkus ?? [],
    comparison_skus: (current.comparison?.items ?? []).map((item) => item.sku),
    basket: (current.cart ?? []).map((item) => ({
      sku: item.sku,
      name: item.name,
      merchant: item.store,
      quantity: item.qty,
      currency: item.currency,
      variant: item.selectedVariant?.title ?? null,
    })),
    totals_by_currency: (current.totals ?? []).map(({ currency, total }) => ({ currency, total })),
    merchant_count: new Set((current.cart ?? []).map((item) => item.store)).size,
    preferences: current.preferences ?? { deliveryCountry: null },
  };
}

export function compactInspection(products, optionQuery = "") {
  const needle = String(optionQuery).trim().toLowerCase();
  return products.map((product) => ({
    sku: product.sku,
    name: product.name,
    merchant: product.merchant,
    merchantCountry: product.merchantCountry,
    market: product.market,
    observedAt: product.observedAt,
    publishedDeliveryCountryCount: product.deliveryCountries?.length ?? 0,
    variantCount: product.variants?.length ?? 0,
    variants: (product.variants ?? [])
      .filter((variant) => !needle || [variant.title, ...(variant.options ?? [])]
        .some((value) => String(value).toLowerCase().includes(needle)))
      .slice(0, 7).map((variant) => ({
      sku: variant.sku,
      title: variant.title,
      options: variant.options,
      available: variant.available,
      price: variant.price,
      currency: variant.currency,
    })),
    truncated: (product.variants?.length ?? 0) > 7 && !needle,
  }));
}
