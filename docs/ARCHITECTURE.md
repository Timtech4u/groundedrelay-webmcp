# BasketShipper high-level architecture

> **A grounded relay between shoppers, agents, and merchants.**

![BasketShipper high-level architecture](assets/basketshipper-high-level-architecture.png)

## What the diagram shows

BasketShipper is a browser-only, three-origin WebMCP system. The shopper
storefront and an independent merchant-demo host are separate static sites.
Neither duplicates the shopping action implementation. Both embed the same
cross-origin provider, discover its prefixed `wire__*` tools, and hoist only the
clean actions that are valid for the state currently visible to the person.

The provider owns nine bounded actions:

- discovery: `list_shops`, `get_shopping_state`, and `search_products`;
- inspection: `inspect_products`, `focus_products`, `compare_products`, and
  `highlight_evidence`; and
- controlled mutation: `set_basket_quantity` and
  `prepare_checkout_handoff`.

The public judge flow uses three BasketShipper-owned fictional catalogues with
six invented products across Rwanda, Kenya, and Ghana. Search and ranking occur
locally in the browser. RWF, KES, and GHS remain separate throughout the
basket and review experience.

## Trust and control boundaries

- Every provider message is checked against the expected origin, source
  window, protocol version, and per-page nonce.
- Provider names retain the `wire__` prefix to avoid collisions. A host proxy
  re-stringifies action input before calling `executeTool()`.
- Tool availability follows visible page state, so an agent cannot invoke a
  clean action before the corresponding human-visible state exists.
- `prepare_checkout_handoff` pauses at a human review surface. Veto rejects the
  pending call and retains the basket. Approval reveals fictional demo links
  only; it cannot navigate, create an order, accept payment, or make a purchase.
- If the native WebMCP page API is absent, the static provider handshake and
  direct shopper controls still support local search, comparison, basket edits,
  and the same human-gated handoff.

## Deployment interpretation

The diagram shows the intended three-origin Cloudflare Pages topology. It is a
target architecture until the exact public storefront, provider, and
merchant-demo URLs have been deployed and passed a signed-out, commit-bound
smoke test. The existing `groundedrelay` URL and repository slugs are stable
technical identifiers; **BasketShipper** is the visible product name.

Cloudflare Browser Run is an optional independent native-WebMCP verification
path after deployment. It is not an application dependency and does not make
an unverified target live.
