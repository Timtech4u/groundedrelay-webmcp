// Build the immutable, reviewable subset that crosses to a host approval UI.
// The exact variant belongs in the authorization surface: product name alone
// is not enough when multiple sizes, colours, or packs share one product.
export function approvalCartSnapshot(cart = []) {
  return cart.map((item) => {
    const variant = item?.selectedVariant;
    const selectedVariant = variant && typeof variant === "object"
      ? {
          title: variant.title == null ? null : String(variant.title),
          options: Array.isArray(variant.options)
            ? variant.options.map((option) => String(option))
            : [],
        }
      : null;
    return {
      sku: item.sku,
      name: item.name,
      store: item.store,
      host: item.host,
      qty: item.qty,
      currency: item.currency,
      selectedVariant,
    };
  });
}

export function approvalRevisionResult(reviewedRevision, currentRevision) {
  const reviewed = Number(reviewedRevision);
  const current = Number(currentRevision);
  if (!Number.isFinite(reviewed) || !Number.isFinite(current) || reviewed !== current) {
    return { outcome: "rejected", valid: false, reason: "stale" };
  }
  return { outcome: "approved", valid: true };
}
