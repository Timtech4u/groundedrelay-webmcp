const FICTIONAL_HANDOFF_STORES = new Map([
  ["groundedrelay-demo-kigali-pantry", "BasketShipper Demo — Kigali Pantry"],
  ["groundedrelay-demo-rift-runworks", "BasketShipper Demo — Rift Runworks"],
  ["groundedrelay-demo-accra-carry-studio", "BasketShipper Demo — Accra Carry Studio"],
]);

export function handoffStoreFromHash(hash) {
  const params = new URLSearchParams(String(hash ?? "").replace(/^#/, ""));
  const entries = [...params.entries()];
  if (entries.length !== 1 || entries[0][0] !== "handoff") return null;
  return FICTIONAL_HANDOFF_STORES.get(entries[0][1]) ?? null;
}

export function uniqueApprovedMerchantLinks(handoff, expectedOrigin) {
  const links = new Map();
  for (const group of Array.isArray(handoff) ? handoff : []) {
    const store = String(group?.store ?? "");
    const slug = [...FICTIONAL_HANDOFF_STORES]
      .find(([, knownStore]) => knownStore === store)?.[0];
    if (!slug || links.has(store)) continue;
    for (const item of Array.isArray(group?.items) ? group.items : []) {
      try {
        const url = new URL(item.url);
        if (url.origin !== expectedOrigin || url.pathname !== "/"
          || url.hash !== `#handoff=${slug}`) continue;
        links.set(store, { store, url: url.href });
        break;
      } catch { /* Ignore malformed or unowned handoff data. */ }
    }
  }
  return [...links.values()];
}
